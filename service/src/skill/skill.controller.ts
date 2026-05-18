import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { extractIsolationContext, IsolationContext } from '../common/services/base-isolated.service';
import { QueryStandardSkillDto, ValidateSkillMdDto } from './dto/skill.dto';
import { success } from '../common/response/api.response';
import { Request } from 'express';
import { SkillRegistry } from './skill-registry';
import { SkillImporter } from './skill-importer';
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator } from './standard/skill-md-validator';

/**
 * 技能管理控制器（标准技能）
 *
 * 实现三层缓存架构：
 * - L1层：技能元数据列表（Redis缓存，TTL 30分钟）
 * - L2层：完整技能描述符（内存LRU缓存，TTL 5分钟）
 * - L3层：参考文档内容（Redis缓存，TTL 1小时）
 *
 * Provider查询顺序：Database -> Filesystem（回源）
 */
@ApiTags('技能（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/skill')
export class SkillController {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly skillImporter: SkillImporter,
    private readonly skillMdParser: SkillMdParser,
    private readonly skillMdValidator: SkillMdValidator,
  ) {}

  // ============================================================
  // 技能发现（经过缓存层）
  // ============================================================

  /**
   * 列出所有可用技能（经过L1缓存）
   * GET /admin/skill/standard/list
   */
  @Get('standard/list')
  @ApiOperation({ summary: '列出标准技能（经过缓存层）' })
  @RequireScope(AdminScope.SKILL_READ)
  async listStandardSkills(@Query() query: QueryStandardSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skills = await this.skillRegistry.listAll(context);
    
    const filtered = query.appCode
      ? skills.filter(s => s.appCode === query.appCode || s.isPublic)
      : skills;

    return success(filtered.map(s => ({
      name: s.name,
      description: s.description,
      source: s.source,
      appCode: s.appCode,
      isPublic: s.isPublic,
      hasReferences: s.hasReferences,
      hasScripts: s.hasScripts,
    })));
  }

  /**
   * 触发技能扫描并同步到数据库（清除所有缓存）
   * POST /admin/skill/standard/scan
   */
  @Post('standard/scan')
  @ApiOperation({ summary: '扫描标准技能目录并同步到数据库' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async scanStandardSkills() {
    const result = await this.skillRegistry.refresh();
    return success(result);
  }

  /**
   * 获取标准技能详情（经过L2缓存）
   * GET /admin/skill/standard/:name
   */
  @Get('standard/:name')
  @ApiOperation({ summary: '获取标准技能详情（经过缓存层）' })
  @RequireScope(AdminScope.SKILL_READ)
  async getStandardSkill(@Param('name') name: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const descriptor = await this.skillRegistry.resolve(name, context);
    
    if (!descriptor) {
      throw new NotFoundException('标准技能不存在');
    }

    return success({
      skillName: descriptor.metadata.name,
      description: descriptor.metadata.description,
      source: descriptor.metadata.source,
      appCode: descriptor.metadata.appCode,
      isPublic: descriptor.metadata.isPublic,
      hasReferences: descriptor.metadata.hasReferences,
      hasScripts: descriptor.metadata.hasScripts,
      frontmatter: descriptor.frontmatter,
      instructions: descriptor.instructions,
      allowedTools: descriptor.allowedTools,
    });
  }

  // ============================================================
  // 导入
  // ============================================================

  /**
   * 导入标准技能（.zip 上传）
   * POST /admin/skill/import
   */
  @Post('import')
  @ApiOperation({ summary: '导入标准技能' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @RequireScope(AdminScope.SKILL_WRITE)
  async importSkill(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { appCode?: string; isPublic?: boolean; overwrite?: boolean },
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传技能文件');
    }
    const context = extractIsolationContext(req);
    const files = await this.extractZipFiles(file.buffer);
    const result = await this.skillImporter.importFromFiles(
      files,
      {
        appCode: body.appCode,
        isPublic: body.isPublic,
        overwrite: body.overwrite,
      },
      context,
    );
    
    // 导入后清除所有缓存
    this.skillRegistry.clearAllCache();
    
    return success(result);
  }

  // ============================================================
  // 索引管理
  // ============================================================

  /**
   * 刷新技能索引（扫描 + 同步 + 清除缓存）
   * POST /admin/skill/refresh
   */
  @Post('refresh')
  @ApiOperation({ summary: '刷新技能索引' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async refreshSkills() {
    await this.skillRegistry.refresh();
    return success(null, '索引已刷新，数据库已同步，缓存已清除');
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  /**
   * 清除指定技能的缓存
   * DELETE /admin/skill/cache/:name
   */
  @Delete('cache/:name')
  @ApiOperation({ summary: '清除指定技能的缓存' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async invalidateSkillCache(@Param('name') name: string) {
    this.skillRegistry.invalidateCache(name);
    return success(null, `技能 "${name}" 的缓存已清除`);
  }

  /**
   * 清除所有技能缓存
   * DELETE /admin/skill/cache
   */
  @Delete('cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清除所有技能缓存' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async clearAllCache() {
    this.skillRegistry.clearAllCache();
    return success(null, '所有技能缓存已清除');
  }

  /**
   * 手动同步技能到数据库
   * POST /admin/skill/sync
   */
  @Post('sync')
  @ApiOperation({ summary: '手动同步技能到数据库' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async syncToDatabase() {
    const synced = await this.skillRegistry.syncToDatabase();
    this.skillRegistry.clearAllCache();
    return success({ synced }, `已同步 ${synced} 个技能到数据库`);
  }

  /**
   * 获取技能缓存统计信息
   * GET /admin/skill/stats
   */
  @Get('stats')
  @ApiOperation({ summary: '获取技能统计信息' })
  @RequireScope(AdminScope.SKILL_READ)
  async getSkillStats() {
    const stats = this.skillRegistry.getStats();
    return success({
      filesystemSkills: stats.filesystemSkills,
      l2CacheSize: stats.l2CacheSize,
      cacheConfig: {
        l1TtlMinutes: stats.cacheConfig.L1_TTL / 60000,
        l2TtlMinutes: stats.cacheConfig.L2_TTL / 60000,
        l3TtlMinutes: stats.cacheConfig.L3_TTL / 60000,
        l2MaxSize: stats.cacheConfig.L2_MAX_SIZE,
      },
    });
  }

  // ============================================================
  // 验证
  // ============================================================

  /**
   * 验证 SKILL.md 内容
   * POST /admin/skill/validate
   */
  @Post('validate')
  @ApiOperation({ summary: '验证 SKILL.md 内容' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async validateSkillMd(@Body() dto: ValidateSkillMdDto) {
    try {
      const parsed = await this.skillMdParser.parseFromString(dto.content);
      const validation = this.skillMdValidator.validate(parsed);
      return success({
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        frontmatter: validation.valid ? parsed.frontmatter : undefined,
      });
    } catch (err) {
      throw new BadRequestException(`SKILL.md 格式错误: ${(err as Error).message}`);
    }
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 从 zip buffer 提取文件映射（含 ZIP 炸弹防护）
   */
  private async extractZipFiles(buffer: Buffer): Promise<Map<string, string>> {
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default(buffer);
    const files = new Map<string, string>();
    const entries = zip.getEntries();

    const MAX_FILES = 100;
    const MAX_UNCOMPRESSED_SIZE = 5 * 1024 * 1024;
    let totalUncompressedSize = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const parts = entry.entryName.replace(/\\/g, '/').split('/');
      if (parts.some(p => p.startsWith('.') || p === '__MACOSX')) continue;

      if (files.size >= MAX_FILES) {
        throw new BadRequestException(`压缩包包含过多文件（超过 ${MAX_FILES} 个），可能存在 ZIP 炸弹攻击`);
      }

      const data = entry.getData();
      totalUncompressedSize += data.length;
      if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
        throw new BadRequestException(
          `解压后总大小超过限制 ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB，可能存在 ZIP 炸弹攻击`,
        );
      }

      files.set(entry.entryName, data.toString('utf-8'));
    }

    return files;
  }
}
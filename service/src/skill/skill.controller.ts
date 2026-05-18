import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { extractIsolationContext } from '../common/utils/isolation.util';
import { QueryStandardSkillDto, ValidateSkillMdDto } from './dto/skill.dto';
import { success } from '../common/response/api.response';
import { Request } from 'express';
import { SkillRegistry } from './skill-registry';
import { SkillScanner } from './standard/skill-scanner';
import { SkillImporter } from './skill-importer';
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator } from './standard/skill-md-validator';

/**
 * 技能管理控制器（标准技能）
 *
 * 所有技能均以 Agent Skills V1.0 标准格式（SKILL.md）存储在文件系统中。
 * 不再维护 DB 技能表。
 */
@ApiTags('技能（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/skill')
export class SkillController {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly skillScanner: SkillScanner,
    private readonly skillImporter: SkillImporter,
    private readonly skillMdParser: SkillMdParser,
    private readonly skillMdValidator: SkillMdValidator,
  ) {}

  // ============================================================
  // 技能发现
  // ============================================================

  /**
   * 列出文件系统发现的技能
   */
  @Get('standard/list')
  @ApiOperation({ summary: '列出标准技能（文件系统）' })
  @RequireScope(AdminScope.SKILL_READ)
  async listStandardSkills(@Query() query: QueryStandardSkillDto) {
    const entries = this.skillScanner.getIndex(query.appCode);
    return success(entries.map(e => ({
      name: e.name,
      description: e.description,
      source: e.source,
      appCode: e.appCode,
      isPublic: e.isPublic,
      hasReferences: e.hasReferences,
      hasScripts: e.hasScripts,
      hasAssets: e.hasAssets,
      discoveredAt: e.discoveredAt,
      fileSize: e.fileSize,
    })));
  }

  /**
   * 触发文件系统技能扫描
   */
  @Post('standard/scan')
  @ApiOperation({ summary: '扫描标准技能目录' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async scanStandardSkills() {
    const result = await this.skillScanner.scan();
    return success(result);
  }

  /**
   * 获取标准技能 SKILL.md 预览
   */
  @Get('standard/:name')
  @ApiOperation({ summary: '预览标准技能 SKILL.md' })
  @RequireScope(AdminScope.SKILL_READ)
  async getStandardSkill(@Param('name') name: string) {
    const entry = this.skillScanner.findByName(name);
    if (!entry) {
      throw new NotFoundException('标准技能不存在');
    }
    try {
      const parsed = await this.skillMdParser.parseFromFile(entry.skillMdPath);
      return success({
        skillName: parsed.frontmatter.name,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        rawContent: `${parsed.rawYaml}\n---\n${parsed.body}`,
      });
    } catch (err) {
      throw new BadRequestException(
        `解析 SKILL.md 失败: ${(err as Error).message}`,
      );
    }
  }

  // ============================================================
  // 导入
  // ============================================================

  /**
   * 导入标准技能（.zip 上传）
   * 仅支持文件系统模式，不再支持导入为 DB 技能。
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
    return success(result);
  }

  // ============================================================
  // 索引管理
  // ============================================================

  /**
   * 刷新技能索引
   */
  @Post('refresh')
  @ApiOperation({ summary: '刷新技能索引' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async refreshSkills() {
    await this.skillRegistry.refresh();
    return success(null, '索引已刷新');
  }

  // ============================================================
  // 验证
  // ============================================================

  /**
   * 验证 SKILL.md 内容
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
    const MAX_UNCOMPRESSED_SIZE = 5 * 1024 * 1024; // 5MB
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

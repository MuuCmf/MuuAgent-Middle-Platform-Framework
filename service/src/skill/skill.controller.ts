import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SkillService } from './skill.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { extractIsolationContext } from '../common/utils/isolation.util';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ExecuteSkillDto,
  QuerySkillDto,
  ImportSkillDto,
  ValidateSkillMdDto,
} from './dto/skill.dto';
import { success, page } from '../common/response/api.response';
import { Request, Response } from 'express';
import { DatabaseExecutor } from './executors/database.executor';
import { SkillRegistry } from './skill-registry';
import { SkillScanner } from './standard/skill-scanner';
import { SkillImporter } from './skill-importer';
import { SkillExporter } from './skill-exporter';
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator } from './standard/skill-md-validator';

/**
 * 技能管理控制器
 */
@ApiTags('技能（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/skill')
export class SkillController {
  /**
   * 构造函数
   * @param skillService 技能服务
   * @param databaseExecutor 数据库执行器
   */
  constructor(
    private readonly skillService: SkillService,
    private readonly databaseExecutor: DatabaseExecutor,
    private readonly skillRegistry: SkillRegistry,
    private readonly skillScanner: SkillScanner,
    private readonly skillImporter: SkillImporter,
    private readonly skillExporter: SkillExporter,
    private readonly skillMdParser: SkillMdParser,
    private readonly skillMdValidator: SkillMdValidator,
  ) {}

  /**
   * 创建技能
   * @param dto 创建技能DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建技能' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async create(@Body() dto: CreateSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.create(dto, context);
    return success(skill, '技能创建成功');
  }

  /**
   * 更新技能
   * @param id 技能ID
   * @param dto 更新技能DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新技能' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.update(id, dto, context);
    return success(skill, '技能更新成功');
  }

  /**
   * 删除技能
   * @param id 技能ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除技能' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.skillService.remove(id, context);
    return success(null, '技能删除成功');
  }

  /**
   * 查询技能列表
   * @param query 查询参数
   * @returns {Promise<Object>} 技能列表
   */
  @Get()
  @ApiOperation({ summary: '查询技能列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async findAll(@Query() query: QuerySkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const { list, total, page: pageNum, pageSize } = await this.skillService.findAll(query, context);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 执行技能
   * @param dto 执行技能DTO
   * @returns {Promise<Object>} 执行结果
   */
  @Post('execute')
  @ApiOperation({ summary: '执行技能' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async execute(@Body() dto: ExecuteSkillDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.skillService.execute(dto, context);
    return success(result);
  }

  /**
   * 渲染技能调用提示词
   * @param body 渲染参数
   * @returns {Promise<Object>} 渲染结果
   */
  @Post('render-prompt')
  @ApiOperation({ summary: '渲染技能调用提示词' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async renderPrompt(
    @Body()
    body: {
      skillCode: string;
      userRequest: string;
    },
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const renderedPrompt = await this.skillService.renderSkillInvokePrompt(
      body.skillCode,
      body.userRequest,
      context,
    );
    return success({ renderedPrompt });
  }

  /**
   * 智能选择技能
   * @param body 选择参数
   * @returns {Promise<Object>} 选择结果
   */
  @Post('select')
  @ApiOperation({ summary: '智能选择技能' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async selectSkill(
    @Body()
    body: {
      userRequest: string;
      availableSkills: string[];
    },
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const result = await this.skillService.selectSkill(
      body.userRequest,
      body.availableSkills,
      context,
    );
    return success(result);
  }

  /**
   * 查询技能详情
   * @param id 技能ID
   * @returns {Promise<Object>} 技能详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询技能详情' })
  @RequireScope(AdminScope.SKILL_READ)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.findOne(id, context);
    return success(skill);
  }

  // ===== Agent Skills 开放标准接口 =====

  /**
   * 列出文件系统发现的技能
   */
  @Get('standard/list')
  @ApiOperation({ summary: '列出标准技能（文件系统）' })
  @RequireScope(AdminScope.SKILL_READ)
  async listStandardSkills() {
    const entries = this.skillScanner.getIndex();
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

  /**
   * 导入标准技能（.zip 上传）
   */
  @Post('import')
  @ApiOperation({ summary: '导入标准技能' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @RequireScope(AdminScope.SKILL_WRITE)
  async importSkill(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportSkillDto,
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
        mode: dto.mode as 'database' | 'filesystem',
        appCode: dto.appCode,
        isPublic: dto.isPublic,
        overwrite: dto.overwrite,
      },
      context,
    );
    return success(result);
  }

  /**
   * 导出 DB 技能为标准 .zip
   */
  @Get(':id/export')
  @ApiOperation({ summary: '导出技能为标准格式' })
  @RequireScope(AdminScope.SKILL_READ)
  async exportSkill(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const context = extractIsolationContext(req);
    const skill = await this.skillService.findOne(id, context);
    const files = await this.skillExporter.exportToStandard(skill.code, context);

    // 在内存中构建 zip
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default();
    for (const [relativePath, content] of files) {
      const fileContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
      zip.addFile(relativePath, fileContent);
    }
    const zipBuffer = zip.toBuffer();

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${skill.code}.zip"`,
      'Content-Length': zipBuffer.length.toString(),
    });
    res.end(zipBuffer);
  }

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

  // ===== 测试与工具接口 =====

  /**
   * 获取内置函数列表
   * @returns {Promise<Object>} 内置函数列表
   */
  @Get('builtin-functions/list')
  @ApiOperation({ summary: '获取内置函数列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async getBuiltinFunctions() {
    const functions = this.skillService.getBuiltinFunctions();
    return success(functions);
  }

  /**
   * 获取插件列表
   * @returns {Promise<Object>} 插件列表
   */
  @Get('plugins/list')
  @ApiOperation({ summary: '获取插件列表' })
  @RequireScope(AdminScope.SKILL_READ)
  async getPlugins() {
    const plugins = this.skillService.getPlugins();
    return success(plugins);
  }

  /**
   * 分析沙箱代码
   * @param body 代码内容
   * @returns {Promise<Object>} 分析结果
   */
  @Post('analyze-code')
  @ApiOperation({ summary: '分析沙箱代码' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async analyzeCode(
    @Body()
    body: {
      code: string;
    },
  ) {
    const result = this.skillService.analyzeCode(body.code);
    return success(result);
  }

  /**
   * 测试函数
   * @param body 测试参数
   * @returns {Promise<Object>} 测试结果
   */
  @Post('test-function')
  @ApiOperation({ summary: '测试函数' })
  @RequireScope(AdminScope.SKILL_EXECUTE)
  async testFunction(
    @Body()
    body: {
      codeType: string;
      pluginName?: string;
      functionName?: string;
      codeContent?: string;
      params: Record<string, unknown>;
    },
  ) {
    const result = await this.skillService.testFunction(body);
    return success(result);
  }

  /**
   * 测试数据库连接
   * @param body 数据库配置 JSON 字符串
   * @returns 连接测试结果
   */
  @Post('test-connection')
  @ApiOperation({ summary: '测试数据库连接' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async testConnection(
    @Body()
    body: {
      config: string;
    },
  ) {
    const result = await this.databaseExecutor.testConnection(body.config);
    return success(result);
  }

  /**
   * 测试 HTTP 请求
   * @param body 请求参数
   * @returns 测试结果
   */
  @Post('test-http')
  @ApiOperation({ summary: '测试HTTP请求' })
  @RequireScope(AdminScope.SKILL_WRITE)
  async testHttp(
    @Body()
    body: {
      config: string;
      params?: Record<string, unknown>;
    },
  ) {
    const result = await this.skillService.testHttpRequest(body.config, body.params || {});
    return success(result);
  }

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

  /**
   * 从 zip buffer 提取文件映射（含 ZIP 炸弹防护）
   */
  private async extractZipFiles(buffer: Buffer): Promise<Map<string, string>> {
    const AdmZip = await import('adm-zip');
    const zip = new AdmZip.default(buffer);
    const files = new Map<string, string>();
    const entries = zip.getEntries();

    // ZIP 炸弹防护：限制单次导入最大文件数和总解压大小
    const MAX_FILES = 100;
    const MAX_UNCOMPRESSED_SIZE = 5 * 1024 * 1024; // 5MB
    let totalUncompressedSize = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      // 跳过隐藏文件和 macOS 元数据
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

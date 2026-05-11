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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromptTemplateService } from './prompt-template.service';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
  QueryPromptTemplateDto,
  RenderPromptTemplateDto,
  RollbackPromptTemplateDto,
} from './dto/prompt-template.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import { extractIsolationContext } from '../common/utils/isolation.util';
import { success } from '../common/response/api.response';
import { Request } from 'express';

/**
 * Prompt 模板控制器
 * 提供模板的管理和渲染接口
 */
@ApiTags('Prompt模板管理')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/prompt-template')
export class PromptTemplateController {
  constructor(private readonly promptTemplateService: PromptTemplateService) {}

  /**
   * 创建模板
   */
  @Post()
  @ApiOperation({ summary: '创建Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async create(@Body() dto: CreatePromptTemplateDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.create(dto, context);
    return success(template, '模板创建成功');
  }

  /**
   * 更新模板
   */
  @Put(':code')
  @ApiOperation({ summary: '更新Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async update(
    @Param('code') code: string,
    @Body() dto: UpdatePromptTemplateDto,
    @Req() req: Request,
  ) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.update(code, dto, context);
    return success(template, '模板更新成功');
  }

  /**
   * 删除模板
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async delete(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    await this.promptTemplateService.delete(id, context);
    return success(null, '模板删除成功');
  }

  /**
   * 查询单个模板
   */
  @Get(':id')
  @ApiOperation({ summary: '查询Prompt模板详情' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_READ)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.findOne(id, context);
    return success(template);
  }

  /**
   * 根据标识查询模板
   */
  @Get('code/:code')
  @ApiOperation({ summary: '根据标识查询Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_READ)
  async findByCode(@Param('code') code: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.findByCode(code, context);
    return success(template);
  }

  /**
   * 查询模板列表
   */
  @Get()
  @ApiOperation({ summary: '查询Prompt模板列表' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_READ)
  async findAll(@Query() query: QueryPromptTemplateDto, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const result = await this.promptTemplateService.findAll(query, context);
    return success(result);
  }

  /**
   * 渲染模板
   */
  @Post('render')
  @ApiOperation({ summary: '渲染Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async render(@Body() dto: RenderPromptTemplateDto, @Req() req: any) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const uid = req.user?.uid;

    const renderedPrompt = await this.promptTemplateService.renderWithLog(
      dto,
      clientIp,
      uid,
    );

    return success({ renderedPrompt }, '模板渲染成功');
  }

  /**
   * 获取版本历史
   */
  @Get(':id/versions')
  @ApiOperation({ summary: '获取Prompt模板版本历史' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_READ)
  async getVersionHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    const versions = await this.promptTemplateService.getVersionHistory(
      id,
      limit || 10,
    );
    return success(versions);
  }

  /**
   * 版本回滚
   */
  @Post(':id/rollback/:version')
  @ApiOperation({ summary: 'Prompt模板版本回滚' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async rollback(
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() dto?: RollbackPromptTemplateDto,
    @Req() req?: Request,
  ) {
    const context = req ? extractIsolationContext(req) : undefined;
    const template = await this.promptTemplateService.rollback(
      id,
      parseInt(version),
      dto,
      context,
    );
    return success(template, '版本回滚成功');
  }

  /**
   * 设置默认模板
   */
  @Post(':id/set-default')
  @ApiOperation({ summary: '设置默认Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_WRITE)
  async setDefault(@Param('id') id: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.setDefault(id, context);
    return success(template, '设置默认模板成功');
  }

  /**
   * 获取默认模板
   */
  @Get('default/:category')
  @ApiOperation({ summary: '获取分类的默认Prompt模板' })
  @RequireScope(AdminScope.PROMPT_TEMPLATE_READ)
  async getDefaultTemplate(@Param('category') category: string, @Req() req: Request) {
    const context = extractIsolationContext(req);
    const template = await this.promptTemplateService.getDefaultTemplate(category, context);
    return success(template);
  }
}

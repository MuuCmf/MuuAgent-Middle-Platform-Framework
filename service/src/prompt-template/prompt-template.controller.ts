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
import { AdminGuard } from '../common/guards/admin.guard';
import { success } from '../common/response/api.response';

/**
 * Prompt 模板控制器
 * 提供模板的管理和渲染接口
 */
@ApiTags('Prompt模板管理')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/prompt-template')
export class PromptTemplateController {
  constructor(private readonly promptTemplateService: PromptTemplateService) {}

  /**
   * 创建模板
   */
  @Post()
  @ApiOperation({ summary: '创建Prompt模板' })
  async create(@Body() dto: CreatePromptTemplateDto) {
    const template = await this.promptTemplateService.create(dto);
    return success(template, '模板创建成功');
  }

  /**
   * 更新模板
   */
  @Put(':code')
  @ApiOperation({ summary: '更新Prompt模板' })
  async update(
    @Param('code') code: string,
    @Body() dto: UpdatePromptTemplateDto,
  ) {
    const template = await this.promptTemplateService.update(code, dto);
    return success(template, '模板更新成功');
  }

  /**
   * 删除模板
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除Prompt模板' })
  async delete(@Param('id') id: string) {
    await this.promptTemplateService.delete(id);
    return success(null, '模板删除成功');
  }

  /**
   * 查询单个模板
   */
  @Get(':id')
  @ApiOperation({ summary: '查询Prompt模板详情' })
  async findOne(@Param('id') id: string) {
    const template = await this.promptTemplateService.findOne(id);
    return success(template);
  }

  /**
   * 根据标识查询模板
   */
  @Get('code/:code')
  @ApiOperation({ summary: '根据标识查询Prompt模板' })
  async findByCode(@Param('code') code: string) {
    const template = await this.promptTemplateService.findByCode(code);
    return success(template);
  }

  /**
   * 查询模板列表
   */
  @Get()
  @ApiOperation({ summary: '查询Prompt模板列表' })
  async findAll(@Query() query: QueryPromptTemplateDto) {
    const result = await this.promptTemplateService.findAll(query);
    return success(result);
  }

  /**
   * 渲染模板
   */
  @Post('render')
  @ApiOperation({ summary: '渲染Prompt模板' })
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
  async rollback(
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() dto?: RollbackPromptTemplateDto,
  ) {
    const template = await this.promptTemplateService.rollback(
      id,
      parseInt(version),
      dto,
    );
    return success(template, '版本回滚成功');
  }

  /**
   * 设置默认模板
   */
  @Post(':id/set-default')
  @ApiOperation({ summary: '设置默认Prompt模板' })
  async setDefault(@Param('id') id: string) {
    const template = await this.promptTemplateService.setDefault(id);
    return success(template, '设置默认模板成功');
  }

  /**
   * 获取默认模板
   */
  @Get('default/:category')
  @ApiOperation({ summary: '获取分类的默认Prompt模板' })
  async getDefaultTemplate(@Param('category') category: string) {
    const template = await this.promptTemplateService.getDefaultTemplate(category);
    return success(template);
  }
}

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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ModelTemplateService } from './model-template.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import {
  CreateModelTemplateDto,
  UpdateModelTemplateDto,
  QueryModelTemplateDto,
} from './dto/model-template.dto';
import { success, page } from '../common/response/api.response';

/**
 * 模型参数模板控制器
 */
@ApiTags('模型参数模板')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/model-template')
export class ModelTemplateController {
  constructor(private readonly service: ModelTemplateService) {}

  /**
   * 创建模型参数模板
   * @param dto 创建DTO
   * @returns {Promise<any>} 创建的模板
   */
  @Post()
  @ApiOperation({ summary: '创建模型参数模板' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_WRITE)
  async create(@Body() dto: CreateModelTemplateDto) {
    const template = await this.service.create(dto);
    return success(template, '模板创建成功');
  }

  /**
   * 更新模型参数模板
   * @param id 模板ID
   * @param dto 更新DTO
   * @returns {Promise<any>} 更新后的模板
   */
  @Put(':id')
  @ApiOperation({ summary: '更新模型参数模板' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateModelTemplateDto) {
    const template = await this.service.update(id, dto);
    return success(template, '模板更新成功');
  }

  /**
   * 删除模型参数模板
   * @param id 模板ID
   * @returns {Promise<any>} 删除的模板
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除模型参数模板' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_WRITE)
  async delete(@Param('id') id: string) {
    const template = await this.service.delete(id);
    return success(template, '模板删除成功');
  }

  /**
   * 获取模型参数模板详情
   * @param id 模板ID
   * @returns {Promise<any>} 模板详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取模型参数模板详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_READ)
  async findOne(@Param('id') id: string) {
    const template = await this.service.findOne(id);
    return success(template);
  }

  /**
   * 根据标识获取模板
   * @param code 模板标识
   * @returns {Promise<any>} 模板详情
   */
  @Get('code/:code')
  @ApiOperation({ summary: '根据标识获取模板' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_READ)
  async findByCode(@Param('code') code: string) {
    const template = await this.service.findByCode(code);
    return success(template);
  }

  /**
   * 查询模型参数模板列表
   * @param query 查询DTO
   * @returns {Promise<{list: any[], total: number}>} 模板列表和总数
   */
  @Get()
  @ApiOperation({ summary: '查询模型参数模板列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_READ)
  async findAll(@Query() query: QueryModelTemplateDto) {
    const { page: pageNum = 1, pageSize = 10 } = query;
    const result = await this.service.findAll(query);
    return page(result.list, result.total, pageNum, pageSize);
  }

  /**
   * 获取指定模型类型的默认模板
   * @param modelType 模型类型
   * @returns {Promise<any>} 默认模板
   */
  @Get('default/:modelType')
  @ApiOperation({ summary: '获取指定模型类型的默认模板' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_READ)
  async getDefaultTemplate(@Param('modelType') modelType: string) {
    const template = await this.service.getDefaultTemplate(modelType);
    return success(template);
  }

  /**
   * 复制模板
   * @param id 模板ID
   * @returns {Promise<any>} 复制的新模板
   */
  @Post('copy/:id')
  @ApiOperation({ summary: '复制模板' })
  @ApiResponse({ status: 201, description: '复制成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_WRITE)
  async copy(@Param('id') id: string) {
    const template = await this.service.copy(id);
    return success(template, '模板复制成功');
  }

  /**
   * 设置默认模板
   * @param id 模板ID
   * @returns {Promise<any>} 更新后的模板
   */
  @Put('set-default/:id')
  @ApiOperation({ summary: '设置默认模板' })
  @ApiResponse({ status: 200, description: '设置成功' })
  @RequireScope(AdminScope.MODEL_TEMPLATE_WRITE)
  async setDefault(@Param('id') id: string) {
    const template = await this.service.setDefault(id);
    return success(template, '默认模板设置成功');
  }
}

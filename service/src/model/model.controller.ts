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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModelService } from './model.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import {
  CreateModelDto,
  UpdateModelDto,
  QueryModelDto,
} from './dto/model.dto';
import { success, page } from '../common/response/api.response';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor';
import { getProvidersByType } from '../ai/providers/provider-registry';

/**
 * 模型管理控制器（管理端）
 * 提供模型的CRUD接口，需要管理员权限
 */
@ApiTags('模型（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/model')
export class ModelAdminController {
  /**
   * 构造函数
   * @param modelService 模型服务
   */
  constructor(private readonly modelService: ModelService) {}

  /**
   * 转换模型响应（添加 hasApiKey 字段，移除 apiKey）
   * @param model 模型数据
   * @returns {any} 转换后的模型数据
   */
  private toResponse(model: any): any {
    const { apiKey, ...rest } = model;
    return {
      ...rest,
      hasApiKey: !!apiKey,
    };
  }

  /**
   * 创建模型
   * @param dto 创建模型DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post()
  @ApiOperation({ summary: '创建模型' })
  @RequireScope(AdminScope.MODEL_WRITE)
  async create(@Body() dto: CreateModelDto) {
    const model = await this.modelService.create(dto);
    return success(this.toResponse(model), '模型创建成功');
  }

  /**
   * 更新模型
   * @param id 模型ID
   * @param dto 更新模型DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id')
  @ApiOperation({ summary: '更新模型' })
  @RequireScope(AdminScope.MODEL_WRITE)
  async update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    const model = await this.modelService.update(id, dto);
    return success(this.toResponse(model), '模型更新成功');
  }

  /**
   * 删除模型
   * @param id 模型ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除模型' })
  @RequireScope(AdminScope.MODEL_WRITE)
  async remove(@Param('id') id: string) {
    await this.modelService.remove(id);
    return success(null, '模型删除成功');
  }

  /**
   * 获取指定模型类型支持的提供商列表
   * @param type 模型类型
   * @returns {Promise<Object>} 提供商列表
   */
  @Get('supported-providers')
  @ApiOperation({ summary: '获取支持的提供商列表' })
  @RequireScope(AdminScope.MODEL_READ)
  async getSupportedProviders(@Query('type') type: string) {
    const providers = getProvidersByType(type || 'llm');
    return success(providers);
  }

  /**
   * 查询模型详情
   * @param id 模型ID
   * @returns {Promise<Object>} 模型详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询模型详情' })
  @RequireScope(AdminScope.MODEL_READ)
  async findOne(@Param('id') id: string) {
    const model = await this.modelService.findOne(id);
    return success(this.toResponse(model));
  }

  /**
   * 查询模型列表
   * @param query 查询参数
   * @returns {Promise<Object>} 模型列表
   */
  @Get()
  @ApiOperation({ summary: '查询模型列表' })
  @RequireScope(AdminScope.MODEL_READ)
  async findAll(@Query() query: QueryModelDto) {
    const { list, total, page: pageNum, pageSize } = await this.modelService.findAll(query);
    const safeList = list.map(model => this.toResponse(model));
    return page(safeList, total, pageNum, pageSize);
  }

  /**
   * 模型健康检查
   * @param id 模型ID
   * @returns {Promise<Object>} 健康检查结果
   */
  @Get(':id/health')
  @ApiOperation({ summary: '模型健康检查' })
  @RequireScope(AdminScope.MODEL_READ)
  async healthCheck(@Param('id') id: string) {
    const result = await this.modelService.healthCheck(id);
    return success(result);
  }

  /**
   * 批量健康检查
   * @returns {Promise<Object>} 所有模型健康检查结果
   */
  @Get('health/all')
  @ApiOperation({ summary: '批量健康检查' })
  @RequireScope(AdminScope.MODEL_READ)
  async healthCheckAll() {
    const results = await this.modelService.healthCheckAll();
    return success(results);
  }

  /**
   * 切换模型状态
   * @param id 模型ID
   * @param status 状态
   * @returns {Promise<Object>} 更新结果
   */
  @Put(':id/status')
  @ApiOperation({ summary: '切换模型状态' })
  @RequireScope(AdminScope.MODEL_WRITE)
  async toggleStatus(@Param('id') id: string, @Body('status') status: boolean) {
    const model = await this.modelService.toggleStatus(id, status);
    return success(this.toResponse(model), '状态更新成功');
  }
}

/**
 * 模型控制器（业务端）
 * 提供公开的模型查询接口，无需认证
 */
@ApiTags('模型（业务端）')
@ApiBearerAuth()
@UseGuards(TenantGuard, RateLimitGuard)
@UseInterceptors(RateLimitInterceptor)
@Controller('model')
export class ModelController {
  /**
   * 构造函数
   * @param modelService 模型服务
   */
  constructor(private readonly modelService: ModelService) {}

  /**
   * 过滤敏感字段
   * @param model 模型数据
   * @returns {any} 过滤后的模型数据
   */
  private filterSensitiveData(model: any): any {
    const { apiKey, endpoint, config, ...safeData } = model;
    return safeData;
  }

  /**
   * 获取启用的模型列表
   * @returns {Promise<Object>} 启用的模型列表
   */
  @Get()
  @ApiOperation({ summary: '获取启用的模型列表' })
  async getEnabledModels() {
    const models = await this.modelService.findAll({ status: true, page: 1, pageSize: 100 });
    const safeModels = models.list.map(model => this.filterSensitiveData(model));
    return success(safeModels);
  }

  /**
   * 获取模型详情
   * @param code 模型代码
   * @returns {Promise<Object>} 模型详情
   */
  @Get(':code')
  @ApiOperation({ summary: '获取模型详情' })
  async getModelByCode(@Param('code') code: string) {
    const model = await this.modelService.findByCode(code);
    return success(this.filterSensitiveData(model));
  }
}

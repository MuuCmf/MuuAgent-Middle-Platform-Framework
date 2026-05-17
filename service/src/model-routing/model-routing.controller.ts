import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModelRoutingService } from "./model-routing.service";
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { AdminScope } from '../common/constants/scope.constants';
import { RequireScope } from '../common/decorators/scope.decorator';
import {
  CreateModelRoutingStrategyDto,
  UpdateModelRoutingStrategyDto,
  CreateModelRoutingRuleDto,
  UpdateModelRoutingRuleDto,
} from "./dto/model-routing.dto";
import { success } from '../common/response/api.response';

/**
 * 模型路由调度控制器
 * 提供策略配置和状态查询接口
 */
@ApiTags('模型路由调度（管理端）')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/model-routing')
export class ModelRoutingController {
  /**
   * 构造函数
   * @param modelRoutingService MCP服务
   */
  constructor(private readonly modelRoutingService: ModelRoutingService) {}

  /**
   * 创建调度策略
   * @param dto 创建策略DTO
   * @returns {Promise<Object>} 创建结果
   */
  @Post('strategy')
  @ApiOperation({ summary: '创建调度策略' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async createStrategy(@Body() dto: CreateModelRoutingStrategyDto) {
    const strategy = await this.modelRoutingService.createStrategy(dto);
    return success(strategy, '策略创建成功');
  }

  /**
   * 更新调度策略
   * @param modelType 模型类型
   * @param dto 更新策略DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put('strategy/:modelType')
  @ApiOperation({ summary: '更新调度策略' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async updateStrategy(
    @Param('modelType') modelType: string,
    @Body() dto: UpdateModelRoutingStrategyDto,
  ) {
    const strategy = await this.modelRoutingService.updateStrategy(modelType, dto);
    return success(strategy, '策略更新成功');
  }

  /**
   * 获取调度策略
   * @param modelType 模型类型
   * @returns {Promise<Object>} 策略详情
   */
  @Get('strategy/:modelType')
  @ApiOperation({ summary: '获取调度策略' })
  @RequireScope(AdminScope.MODEL_ROUTING_READ)
  async getStrategy(@Param('modelType') modelType: string) {
    const strategy = await this.modelRoutingService.getStrategy(modelType);
    return success(strategy);
  }

  /**
   * 获取所有调度策略
   * @returns {Promise<Object>} 策略列表
   */
  @Get('strategies')
  @ApiOperation({ summary: '获取所有调度策略' })
  @RequireScope(AdminScope.MODEL_ROUTING_READ)
  async getAllStrategies() {
    const strategies = await this.modelRoutingService.getAllStrategies();
    return success(strategies);
  }

  /**
   * 获取所有熔断规则
   * @returns {Promise<Object>} 规则列表
   */
  @Get('rules')
  @ApiOperation({ summary: '获取所有熔断规则' })
  @RequireScope(AdminScope.MODEL_ROUTING_READ)
  async getAllRules() {
    const rules = await this.modelRoutingService.getAllRules();
    return success(rules);
  }

  /**
   * 创建或更新模型规则
   * @param dto 创建规则DTO
   * @returns {Promise<Object>} 创建或更新结果
   */
  @Post('rule')
  @ApiOperation({ summary: '创建或更新模型规则' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async upsertRule(@Body() dto: CreateModelRoutingRuleDto) {
    const rule = await this.modelRoutingService.upsertRule(dto.modelId, dto);
    return success(rule, '规则配置成功');
  }

  /**
   * 更新模型规则
   * @param modelId 模型ID
   * @param dto 更新规则DTO
   * @returns {Promise<Object>} 更新结果
   */
  @Put('rule/:modelId')
  @ApiOperation({ summary: '更新模型规则' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async updateRule(
    @Param('modelId') modelId: string,
    @Body() dto: UpdateModelRoutingRuleDto,
  ) {
    const rule = await this.modelRoutingService.updateRule(modelId, dto);
    return success(rule, '规则更新成功');
  }

  /**
   * 获取模型规则
   * @param modelId 模型ID
   * @returns {Promise<Object>} 规则详情
   */
  @Get('rule/:modelId')
  @ApiOperation({ summary: '获取模型规则' })
  @RequireScope(AdminScope.MODEL_ROUTING_READ)
  async getRule(@Param('modelId') modelId: string) {
    const rule = await this.modelRoutingService.getRule(modelId);
    return success(rule);
  }

  /**
   * 删除模型规则
   * @param modelId 模型ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete('rule/:modelId')
  @ApiOperation({ summary: '删除模型规则' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async deleteRule(@Param('modelId') modelId: string) {
    await this.modelRoutingService.deleteRule(modelId);
    return success(null, '规则删除成功');
  }

  /**
   * 重置熔断状态
   * @param modelId 模型ID
   * @returns {Promise<Object>} 重置结果
   */
  @Post('circuit/reset/:modelId')
  @ApiOperation({ summary: '重置熔断状态' })
  @RequireScope(AdminScope.MODEL_ROUTING_WRITE)
  async resetCircuit(@Param('modelId') modelId: string) {
    const rule = await this.modelRoutingService.resetCircuit(modelId);
    return success(rule, '熔断状态已重置');
  }

  /**
   * 获取所有模型状态
   * @returns {Promise<Object>} 模型状态列表
   */
  @Get('status')
  @ApiOperation({ summary: '获取所有模型状态' })
  @RequireScope(AdminScope.MODEL_ROUTING_READ)
  async getAllModelStatus() {
    const statuses = await this.modelRoutingService.getAllModelStatus();
    return success(statuses);
  }
}

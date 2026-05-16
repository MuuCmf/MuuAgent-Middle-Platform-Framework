import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntentRoutingLogService } from './intent-routing-log.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { QueryRoutingLogDto } from './dto/intent-routing-log.dto';
import { success, page } from '../common/response/api.response';

/**
 * 意图路由日志控制器
 * 提供路由日志的查询功能
 */
@ApiTags('意图路由日志')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/intent-routing-log')
export class IntentRoutingLogController {
  /**
   * 构造函数
   * @param routingLogService 路由日志服务
   */
  constructor(private readonly routingLogService: IntentRoutingLogService) {}

  /**
   * 查询路由日志列表
   * @param query 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  @Get()
  @ApiOperation({ summary: '查询路由日志列表' })
  @RequireScope(AdminScope.INTENT_ROUTING_LOG_READ)
  async findAll(@Query() query: QueryRoutingLogDto) {
    const { list, total, page: pageNum, pageSize } = await this.routingLogService.findAll(query);
    return page(list, total, pageNum, pageSize);
  }

  /**
   * 获取路由日志统计
   * @returns {Promise<Object>} 统计信息
   */
  @Get('stats')
  @ApiOperation({ summary: '获取路由日志统计' })
  @RequireScope(AdminScope.INTENT_ROUTING_LOG_READ)
  async getStats() {
    const stats = await this.routingLogService.getStats();
    return success(stats);
  }

  /**
   * 查询路由日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询路由日志详情' })
  @RequireScope(AdminScope.INTENT_ROUTING_LOG_READ)
  async findOne(@Param('id') id: string) {
    const log = await this.routingLogService.findOne(id);
    return success(log);
  }
}
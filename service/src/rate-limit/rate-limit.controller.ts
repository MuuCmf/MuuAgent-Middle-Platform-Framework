import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RateLimitService, RateLimitLevel } from './rate-limit.service';
import { CreateRateLimitRuleDto, UpdateRateLimitRuleDto, AddBlacklistDto } from './dto/rate-limit.dto';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { success } from '../common/response/api.response';

/**
 * 限流管理控制器
 * 提供限流规则配置和统计查询接口
 */
@ApiTags('限流管理')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/rate-limit')
export class RateLimitController {
  /**
   * 构造函数
   * @param rateLimitService 限流服务
   */
  constructor(private readonly rateLimitService: RateLimitService) {}

  /**
   * 创建或更新限流规则
   * @param dto 创建规则DTO
   * @returns {Promise<Object>} 创建或更新的规则
   */
  @Post('rule')
  @ApiOperation({ summary: '创建或更新限流规则' })
  @RequireScope(AdminScope.RATE_LIMIT_WRITE)
  async upsertRule(@Body() dto: CreateRateLimitRuleDto) {
    const rule = await this.rateLimitService.upsertRule(
      dto.level as RateLimitLevel,
      dto.target,
      {
        qpsLimit: dto.qpsLimit,
        concurrentLimit: dto.concurrentLimit,
        dailyLimit: dto.dailyLimit,
        burstSize: dto.burstSize,
        enableQueue: dto.enableQueue,
        queueSize: dto.queueSize,
        queueTimeout: dto.queueTimeout,
      },
    );
    return success(rule, '限流规则配置成功');
  }

  /**
   * 获取所有限流规则
   * @returns {Promise<Object>} 规则列表
   */
  @Get('rules')
  @ApiOperation({ summary: '获取所有限流规则' })
  @RequireScope(AdminScope.RATE_LIMIT_READ)
  async getAllRules() {
    const rules = await this.rateLimitService.getAllRules();
    return success(rules);
  }

  /**
   * 获取限流统计信息
   * @returns {Promise<Object>} 统计信息
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取限流统计信息' })
  @RequireScope(AdminScope.RATE_LIMIT_READ)
  async getStatistics() {
    const stats = await this.rateLimitService.getStatistics();
    return success(stats);
  }

  /**
   * 添加IP到黑名单
   * @param dto 添加黑名单DTO
   * @returns {Promise<Object>} 操作结果
   */
  @Post('blacklist')
  @ApiOperation({ summary: '添加IP到黑名单' })
  @RequireScope(AdminScope.RATE_LIMIT_WRITE)
  async addToBlacklist(@Body() dto: AddBlacklistDto) {
    await this.rateLimitService.addToBlacklist(dto.clientIp, dto.reason, dto.duration);
    return success(null, 'IP已添加到黑名单');
  }

  /**
   * 初始化默认限流规则
   * @returns {Promise<Object>} 初始化结果
   */
  @Post('init')
  @ApiOperation({ summary: '初始化默认限流规则' })
  @RequireScope(AdminScope.RATE_LIMIT_WRITE)
  async initDefaultRules() {
    // 全局限流规则
    await this.rateLimitService.upsertRule(RateLimitLevel.GLOBAL, 'global', {
      qpsLimit: 1000,
      concurrentLimit: 100,
      dailyLimit: 1000000,
      burstSize: 200,
    });

    // AI普通调用接口限流规则
    await this.rateLimitService.upsertRule(RateLimitLevel.INTERFACE, '/api/ai/invoke', {
      qpsLimit: 100,
      concurrentLimit: 50,
      dailyLimit: 100000,
      burstSize: 150,
    });

    // AI流式调用接口限流规则
    await this.rateLimitService.upsertRule(RateLimitLevel.INTERFACE, '/api/ai/stream', {
      qpsLimit: 50,
      concurrentLimit: 30,
      dailyLimit: 50000,
      burstSize: 80,
    });

    // Agent接口限流规则
    await this.rateLimitService.upsertRule(RateLimitLevel.INTERFACE, '/api/agent/chat', {
      qpsLimit: 50,
      concurrentLimit: 30,
      dailyLimit: 50000,
      burstSize: 100,
    });

    return success(null, '默认限流规则初始化成功');
  }
}

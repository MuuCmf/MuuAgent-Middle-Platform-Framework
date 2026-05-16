import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { success } from '../common/response/api.response';

/**
 * 意图监控看板控制器
 * 提供意图分类统计、趋势分析等监控数据
 */
@ApiTags('意图监控')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/intent-dashboard')
export class IntentDashboardController {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 获取意图分类概览统计
   * @returns {Promise<Object>} 分类统计
   */
  @Get('overview')
  @ApiOperation({ summary: '获取意图分类概览统计' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getOverview() {
    // 缓存统计
    const cacheStats = await this.prisma.intentCache.aggregate({
      _count: { id: true },
      _sum: { hitCount: true },
    });

    // 各意图缓存分布
    const cacheDistribution = await this.prisma.intentCache.groupBy({
      by: ['intent'],
      _count: { id: true },
      _sum: { hitCount: true },
    });

    // 缓存来源分布
    const sourceDistribution = await this.prisma.intentCache.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    // 路由日志统计
    const routingStats = await this.prisma.intentRoutingLog.aggregate({
      _count: { id: true },
      _avg: { costMs: true, confidence: true },
    });

    // 降级统计
    const degradeCount = await this.prisma.intentRoutingLog.count({
      where: { isDegraded: true },
    });

    // 各意图路由分布
    const intentDistribution = await this.prisma.intentRoutingLog.groupBy({
      by: ['detectedIntent'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return success({
      cache: {
        total: cacheStats._count.id,
        totalHits: cacheStats._sum.hitCount || 0,
        distribution: cacheDistribution.map(d => ({
          intent: d.intent,
          count: d._count.id,
          hits: d._sum.hitCount || 0,
        })),
        sourceDistribution: sourceDistribution.map(d => ({
          source: d.source,
          count: d._count.id,
        })),
      },
      routing: {
        total: routingStats._count.id,
        avgCostMs: Math.round(routingStats._avg.costMs || 0),
        avgConfidence: Math.round((routingStats._avg.confidence || 0) * 100) / 100,
        degradeCount,
        degradeRate: routingStats._count.id > 0
          ? Math.round((degradeCount / routingStats._count.id) * 10000) / 100
          : 0,
        intentDistribution: intentDistribution.map(d => ({
          intent: d.detectedIntent,
          count: d._count.id,
        })),
      },
    });
  }

  /**
   * 获取意图分类趋势（按天）
   * @param days 天数
   * @returns {Promise<Object>} 趋势数据
   */
  @Get('trend')
  @ApiOperation({ summary: '获取意图分类趋势' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getTrend(@Query('days') days?: number) {
    const daysCount = days || 7;
    const since = new Date();
    since.setDate(since.getDate() - daysCount);

    const logs = await this.prisma.intentRoutingLog.findMany({
      where: { createdAt: { gte: since } },
      select: { detectedIntent: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // 按天分组
    const trendMap: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = {};
      }
      trendMap[dateKey][log.detectedIntent] = (trendMap[dateKey][log.detectedIntent] || 0) + 1;
    }

    const trend = Object.entries(trendMap).map(([date, intents]) => ({
      date,
      ...intents,
      total: Object.values(intents).reduce((a, b) => a + b, 0),
    }));

    return success(trend);
  }

  /**
   * 获取降级事件列表
   * @param page 页码
   * @param pageSize 每页数量
   * @returns {Promise<Object>} 降级事件列表
   */
  @Get('degradations')
  @ApiOperation({ summary: '获取降级事件列表' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getDegradations(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const pageNum = page || 1;
    const size = pageSize || 20;
    const skip = (pageNum - 1) * size;

    const [list, total] = await Promise.all([
      this.prisma.intentRoutingLog.findMany({
        where: { isDegraded: true },
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.intentRoutingLog.count({ where: { isDegraded: true } }),
    ]);

    return success({ list, total, page: pageNum, pageSize: size });
  }

  /**
   * 获取模型路由分布
   * @returns {Promise<Object>} 模型路由分布
   */
  @Get('model-distribution')
  @ApiOperation({ summary: '获取模型路由分布' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getModelDistribution() {
    const distribution = await this.prisma.intentRoutingLog.groupBy({
      by: ['selectedModelCode', 'modelType'],
      _count: { id: true },
      _avg: { costMs: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return success(distribution.map(d => ({
      modelCode: d.selectedModelCode,
      modelType: d.modelType,
      count: d._count.id,
      avgCostMs: Math.round(d._avg.costMs || 0),
    })));
  }

  /**
   * 获取模型使用排行
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param limit 返回数量
   * @returns {Promise<Object>} 模型使用排行
   */
  @Get('model-usage')
  @ApiOperation({ summary: '获取模型使用排行' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getModelUsage(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    const where: any = {};
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const total = await this.prisma.intentRoutingLog.count({ where });

    const distribution = await this.prisma.intentRoutingLog.groupBy({
      by: ['selectedModelCode'],
      where,
      _count: { id: true },
      _avg: { costMs: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit || 10,
    });

    const successCounts = await Promise.all(
      distribution.map(async (d) => {
        const code = d.selectedModelCode || 'unknown';
        const successCount = await this.prisma.intentRoutingLog.count({
          where: { ...where, selectedModelCode: d.selectedModelCode, success: true },
        });
        return { modelCode: code, successCount };
      }),
    );

    const successMap: Record<string, number> = {};
    successCounts.forEach((s) => { successMap[s.modelCode] = s.successCount; });

    return success(distribution.map(d => {
      const code = d.selectedModelCode || 'unknown';
      const count = d._count.id;
      return {
        modelCode: code,
        modelName: code,
        count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        successRate: count > 0 ? Math.round(((successMap[code] || 0) / count) * 10000) / 100 : 0,
        avgCostMs: Math.round(d._avg.costMs || 0),
      };
    }));
  }

  /**
   * 获取意图分布
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns {Promise<Object>} 意图分布
   */
  @Get('intent-distribution')
  @ApiOperation({ summary: '获取意图分布' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getIntentDistribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const total = await this.prisma.intentRoutingLog.count({ where });

    const distribution = await this.prisma.intentRoutingLog.groupBy({
      by: ['detectedIntent'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return success(distribution.map(d => ({
      intent: d.detectedIntent,
      count: d._count.id,
      percentage: total > 0 ? Math.round((d._count.id / total) * 10000) / 100 : 0,
    })));
  }

  /**
   * 获取降级统计
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns {Promise<Object>} 降级统计
   */
  @Get('degrade-stats')
  @ApiOperation({ summary: '获取降级统计' })
  @RequireScope(AdminScope.INTENT_DASHBOARD_READ)
  async getDegradeStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = { isDegraded: true };
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const total = await this.prisma.intentRoutingLog.count({ where });

    const distribution = await this.prisma.intentRoutingLog.groupBy({
      by: ['degradeReason'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return success(distribution.map(d => ({
      reason: d.degradeReason || '未知原因',
      count: d._count.id,
      percentage: total > 0 ? Math.round((d._count.id / total) * 10000) / 100 : 0,
    })));
  }
}
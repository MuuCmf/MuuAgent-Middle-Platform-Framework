import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { CombinedAuthGuard } from '../common/guards/combined-auth.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireScope } from '../common/decorators/scope.decorator';
import { AdminScope } from '../common/constants/scope.constants';
import { success, page } from '../common/response/api.response';

/**
 * 意图缓存管理控制器
 * 提供意图缓存的查看和清除功能
 */
@ApiTags('意图缓存')
@ApiBearerAuth()
@UseGuards(CombinedAuthGuard, ScopeGuard)
@Controller('admin/intent-cache')
export class IntentCacheController {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 查询缓存列表
   * @param intent 意图筛选
   * @param source 来源筛选
   * @param page 页码
   * @param pageSize 每页数量
   * @returns {Promise<Object>} 缓存列表
   */
  @Get()
  @ApiOperation({ summary: '查询缓存列表' })
  @RequireScope(AdminScope.INTENT_CACHE_READ)
  async findAll(
    @Query('intent') intent?: string,
    @Query('source') source?: string,
    @Query('page') pageParam?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const pageNum = pageParam || 1;
    const size = pageSize || 20;
    const skip = (pageNum - 1) * size;

    const where: Record<string, unknown> = {};
    if (intent) where.intent = intent;
    if (source) where.source = source;

    const [list, total] = await Promise.all([
      this.prisma.intentCache.findMany({
        where,
        skip,
        take: size,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.intentCache.count({ where }),
    ]);

    return page(list, total, pageNum, size);
  }

  /**
   * 获取缓存统计
   * @returns {Promise<Object>} 缓存统计
   */
  @Get('stats')
  @ApiOperation({ summary: '获取缓存统计' })
  @RequireScope(AdminScope.INTENT_CACHE_READ)
  async getStats() {
    const total = await this.prisma.intentCache.count();
    const totalHits = await this.prisma.intentCache.aggregate({
      _sum: { hitCount: true },
    });

    const intentDistribution = await this.prisma.intentCache.groupBy({
      by: ['intent'],
      _count: { id: true },
    });

    const sourceDistribution = await this.prisma.intentCache.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const byIntent: Record<string, number> = {};
    intentDistribution.forEach(d => { byIntent[d.intent] = d._count.id; });

    const bySource: Record<string, number> = {};
    sourceDistribution.forEach(d => { bySource[d.source] = d._count.id; });

    return success({
      total,
      totalHits: totalHits._sum.hitCount || 0,
      byIntent,
      bySource,
    });
  }

  /**
   * 查询缓存详情
   * @param id 缓存ID
   * @returns {Promise<Object>} 缓存详情
   */
  @Get(':id')
  @ApiOperation({ summary: '查询缓存详情' })
  @RequireScope(AdminScope.INTENT_CACHE_READ)
  async findOne(@Param('id') id: string) {
    const cache = await this.prisma.intentCache.findUnique({ where: { id: id as any } });
    return success(cache);
  }

  /**
   * 删除单条缓存
   * @param id 缓存ID
   * @returns {Promise<Object>} 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除单条缓存' })
  @RequireScope(AdminScope.INTENT_CACHE_WRITE)
  async remove(@Param('id') id: string) {
    await this.prisma.intentCache.delete({ where: { id: id as any } });
    return success(null, '缓存删除成功');
  }

  /**
   * 按条件清除缓存
   * @param intent 意图类型
   * @param source 来源类型
   * @returns {Promise<Object>} 清除结果
   */
  @Delete('clear')
  @ApiOperation({ summary: '按条件清除缓存' })
  @RequireScope(AdminScope.INTENT_CACHE_WRITE)
  async clearByFilter(
    @Query('intent') intent?: string,
    @Query('source') source?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (intent) where.intent = intent;
    if (source) where.source = source;
    const result = await this.prisma.intentCache.deleteMany({ where });
    return success({ cleared: result.count }, `已清除 ${result.count} 条缓存`);
  }

  /**
   * 清除全部缓存
   * @returns {Promise<Object>} 清除结果
   */
  @Delete('clear-all')
  @ApiOperation({ summary: '清除全部缓存' })
  @RequireScope(AdminScope.INTENT_CACHE_WRITE)
  async clearAll() {
    const result = await this.prisma.intentCache.deleteMany();
    return success({ cleared: result.count }, `已清除全部 ${result.count} 条缓存`);
  }
}
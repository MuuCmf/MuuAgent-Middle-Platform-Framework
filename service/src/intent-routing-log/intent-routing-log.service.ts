import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { QueryRoutingLogDto } from './dto/intent-routing-log.dto';

/**
 * 路由日志记录参数
 */
export interface CreateRoutingLogParams {
  /** 用户消息 */
  userMessage: string;
  /** 检测到的意图 */
  detectedIntent: string;
  /** 置信度 */
  confidence: number;
  /** 分类来源 */
  source: string;
  /** 选中的模型ID */
  selectedModelId?: string | number;
  /** 选中的模型标识 */
  selectedModelCode?: string;
  /** 模型类型 */
  modelType?: string;
  /** 是否降级 */
  isDegraded?: boolean;
  /** 降级原因 */
  degradeReason?: string;
  /** 路由耗时(毫秒) */
  costMs?: number;
  /** 是否成功 */
  success?: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 客户端IP */
  clientIp?: string;
  /** 用户ID */
  uid?: string;
  /** 应用标识 */
  appCode?: string;
}

/**
 * 意图路由日志服务
 * 记录和查询意图路由决策过程
 */
@Injectable()
export class IntentRoutingLogService {
  private readonly logger = new Logger(IntentRoutingLogService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 记录路由日志
   * @param params 日志参数
   * @returns {Promise<Object>} 创建的日志
   */
  async log(params: CreateRoutingLogParams) {
    try {
      return await this.prisma.intentRoutingLog.create({
        data: {
          userMessage: params.userMessage,
          detectedIntent: params.detectedIntent,
          confidence: params.confidence,
          source: params.source,
          selectedModelId: params.selectedModelId ? (params.selectedModelId as any) : null,
          selectedModelCode: params.selectedModelCode || null,
          modelType: params.modelType || null,
          isDegraded: params.isDegraded ?? false,
          degradeReason: params.degradeReason || null,
          costMs: params.costMs ?? 0,
          success: params.success ?? true,
          errorMessage: params.errorMessage || null,
          clientIp: params.clientIp || null,
          uid: params.uid || null,
          appCode: params.appCode || null,
        },
      });
    } catch (error) {
      this.logger.error(`记录路由日志失败: ${error}`);
    }
  }

  /**
   * 分页查询路由日志
   * @param query 查询参数
   * @returns {Promise<Object>} 分页日志列表
   */
  async findAll(query: QueryRoutingLogDto) {
    const {
      intent,
      modelCode,
      isDegraded,
      success,
      source,
      appCode,
      page = 1,
      pageSize = 20,
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (intent) where.detectedIntent = intent;
    if (modelCode) where.selectedModelCode = modelCode;
    if (isDegraded !== undefined) where.isDegraded = isDegraded;
    if (success !== undefined) where.success = success;
    if (source) where.source = source;
    if (appCode) where.appCode = appCode;

    const [list, total] = await Promise.all([
      this.prisma.intentRoutingLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.intentRoutingLog.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 查询单条日志
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  async findOne(id: string) {
    return this.prisma.intentRoutingLog.findUnique({ where: { id: id as any } });
  }

  /**
   * 获取路由日志统计
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const total = await this.prisma.intentRoutingLog.count();
    const degradeCount = await this.prisma.intentRoutingLog.count({
      where: { isDegraded: true },
    });
    const failCount = await this.prisma.intentRoutingLog.count({
      where: { success: false },
    });

    const avgCost = await this.prisma.intentRoutingLog.aggregate({
      _avg: { costMs: true },
    });

    return {
      total,
      successRate: total > 0 ? Math.round(((total - failCount) / total) * 10000) / 100 : 100,
      avgCostMs: Math.round(avgCost._avg.costMs || 0),
      degradeRate: total > 0 ? Math.round((degradeCount / total) * 10000) / 100 : 0,
    };
  }
}
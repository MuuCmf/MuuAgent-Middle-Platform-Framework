import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * 日志服务
 * 提供日志查询和统计功能
 */
@Injectable()
export class LogService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 解析检索结果JSON
   * @param resultsJson 检索结果JSON字符串
   * @returns {Array | null} 解析后的结果数组
   */
  private parseResults(resultsJson: string | null): Array<{ chunkId: string; score: number; docName: string; content: string }> | null {
    if (!resultsJson) {
      return null;
    }
    try {
      return JSON.parse(resultsJson);
    } catch {
      return null;
    }
  }

  /**
   * 查询检索日志
   * @param params 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  async getRetrievalLogs(params: {
    kbId?: string;
    uid?: string;
    query?: string;
    startTime?: string;
    endTime?: string;
    page?: number | string;
    pageSize?: number | string;
  }) {
    const { kbId, uid, query, startTime, endTime } = params;

    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;

    const skip = (page - 1) * pageSize;
    const where: Prisma.KbRetrievalLogWhereInput = {};

    if (kbId) where.kbId = kbId as any;
    if (uid) where.uid = uid as any;
    if (query) where.query = { contains: query as any };

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = new Date(startTime);
      if (endTime) where.createdAt.lte = new Date(endTime);
    }

    const [rawList, total] = await Promise.all([
      this.prisma.kbRetrievalLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          kbInfo: {
            select: {
              id: true,
              kbName: true,
            },
          },
        },
      }),
      this.prisma.kbRetrievalLog.count({ where }),
    ]);

    const list = rawList.map(log => ({
      ...log,
      results: this.parseResults(log.results),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取检索日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  async getRetrievalLogById(id: string) {
    const log = await this.prisma.kbRetrievalLog.findUnique({
      where: { id: id as any },
      include: {
        kbInfo: {
          select: {
            id: true,
            kbName: true,
            status: true,
          },
        },
      },
    });

    if (!log) {
      throw new Error('检索日志不存在');
    }

    return {
      ...log,
      results: this.parseResults(log.results),
    };
  }

  /**
   * 获取检索统计
   * @param kbId 知识库ID（可选）
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<Object>} 统计数据
   */
  async getRetrievalStatistics(kbId?: string, startTime?: string, endTime?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startTime) dateFilter.gte = new Date(startTime);
    if (endTime) dateFilter.lte = new Date(endTime);

    const where: Prisma.KbRetrievalLogWhereInput = {};
    if (kbId) where.kbId = kbId as any;
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

    // 总检索次数
    const total = await this.prisma.kbRetrievalLog.count({ where });

    // 平均耗时
    const avgCost = await this.prisma.kbRetrievalLog.aggregate({
      where,
      _avg: { costTime: true },
    });

    // 平均召回数
    const avgRetrievalCount = await this.prisma.kbRetrievalLog.aggregate({
      where,
      _avg: { retrievalCount: true },
    });

    // 按知识库统计
    const kbStats = kbId ? [] : await this.prisma.kbRetrievalLog.groupBy({
      by: ['kbId'],
      where,
      _count: { id: true },
      _avg: { costTime: true, retrievalCount: true },
    });

    return {
      total,
      avgCostMs: avgCost._avg.costTime ? Math.round(avgCost._avg.costTime) : 0,
      avgRetrievalCount: avgRetrievalCount._avg.retrievalCount ? Math.round(avgRetrievalCount._avg.retrievalCount) : 0,
      kbStats: kbStats.map((s: { kbId: any; _count: { id: number }; _avg: { costTime: number | null; retrievalCount: number | null } }) => ({
        kbId: s.kbId as any,
        count: s._count.id,
        avgCostMs: s._avg.costTime ? Math.round(s._avg.costTime) : 0,
        avgRetrievalCount: s._avg.retrievalCount ? Math.round(s._avg.retrievalCount) : 0,
      })),
    };
  }

  /**
   * 查询AI调用日志
   * @param params 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  async getAiLogs(params: {
    modelId?: string;
    modelCode?: string;
    modelType?: string;
    success?: boolean;
    startTime?: string;
    endTime?: string;
    uid?: string;
    page?: number | string;
    pageSize?: number | string;
  }) {
    const {
      modelId,
      modelCode,
      modelType,
      success,
      startTime,
      endTime,
      uid,
    } = params;

    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;

    const skip = (page - 1) * pageSize;
    const where: Prisma.AiInvokeLogWhereInput = {};

    if (modelId) where.modelId = modelId as any;
    if (modelCode) where.modelCode = { contains: modelCode };
    if (modelType) where.modelType = modelType;
    if (success !== undefined) where.success = success;
    if (uid) where.uid = uid;

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = new Date(startTime);
      if (endTime) where.createdAt.lte = new Date(endTime);
    }

    const [list, total] = await Promise.all([
      this.prisma.aiInvokeLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          model: {
            select: {
              id: true,
              name: true,
              code: true,
              provider: true,
            },
          },
        },
      }),
      this.prisma.aiInvokeLog.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 查询单个AI调用日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  async getAiLogById(id: string) {
    const log = await this.prisma.aiInvokeLog.findUnique({
      where: { id: id as any },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            code: true,
            provider: true,
            type: true,
          },
        },
      },
    });

    if (!log) {
      throw new Error('日志不存在');
    }

    return log;
  }

  /**
   * 查询技能调用日志
   * @param params 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  async getSkillLogs(params: {
    skillCode?: string;
    success?: boolean;
    startTime?: string;
    endTime?: string;
    uid?: string;
    page?: number | string;
    pageSize?: number | string;
  }) {
    const {
      skillCode,
      success,
      startTime,
      endTime,
      uid,
    } = params;

    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;

    const skip = (page - 1) * pageSize;
    const where: Prisma.SkillInvokeLogWhereInput = {};

    if (skillCode) where.skillCode = skillCode;
    if (success !== undefined) where.success = success;
    if (uid) where.uid = uid;

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = new Date(startTime);
      if (endTime) where.createdAt.lte = new Date(endTime);
    }

    const [rawList, total] = await Promise.all([
      this.prisma.skillInvokeLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skillInvokeLog.count({ where }),
    ]);

    const list = rawList.map((log) => ({
      ...log,
      request: log.params,
      response: log.result,
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 查询Agent调用日志
   * @param params 查询参数
   * @returns {Promise<Object>} 日志列表
   */
  async getAgentLogs(params: {
    agentId?: string;
    agentCode?: string;
    conversationId?: string;
    success?: boolean;
    startTime?: string;
    endTime?: string;
    uid?: string;
    page?: number | string;
    pageSize?: number | string;
  }) {
    const {
      agentId,
      agentCode,
      conversationId,
      success,
      startTime,
      endTime,
      uid,
    } = params;

    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;

    const skip = (page - 1) * pageSize;
    const where: Prisma.AgentInvokeLogWhereInput = {};

    if (agentId) {
      where.agentId = agentId as any;
    } else if (agentCode) {
      const agent = await this.prisma.agent.findFirst({
        where: { code: agentCode },
        select: { id: true },
      });
      if (agent) {
        where.agentId = agent.id as any;
      }
    }
    if (conversationId) where.conversationId = conversationId as any;
    if (success !== undefined) where.success = success;
    if (uid) where.uid = uid;

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = new Date(startTime);
      if (endTime) where.createdAt.lte = new Date(endTime);
    }

    const [rawList, total] = await Promise.all([
      this.prisma.agentInvokeLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.agentInvokeLog.count({ where }),
    ]);

    // 字段映射：将数据库字段转换为前端期望的字段名
    const list = rawList.map((log) => ({
      ...log,
      request: log.userMessage,
      response: log.agentResponse,
      costMs: log.totalCostMs,
      userAgent: undefined,
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 查询单个Agent调用日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  async getAgentLogById(id: string) {
    const log = await this.prisma.agentInvokeLog.findUnique({
      where: { id: id as any },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        reasoningSteps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!log) {
      throw new Error('Agent调用日志不存在');
    }

    // 字段映射：将数据库字段转换为前端期望的字段名
    return {
      ...log,
      request: log.userMessage,
      response: log.agentResponse,
      costMs: log.totalCostMs,
      userAgent: undefined,
    };
  }

  /**
   * 获取Agent调用日志的推理步骤
   * @param id 日志ID
   * @returns {Promise<Object>} 推理步骤信息
   */
  async getAgentLogReasoningSteps(id: string) {
    const log = await this.prisma.agentInvokeLog.findUnique({
      where: { id: id as any },
      select: {
        id: true,
        reasoningMode: true,
        reasoningSteps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!log) {
      throw new Error('Agent调用日志不存在');
    }

    return {
      agentLogId: log.id,
      reasoningMode: log.reasoningMode,
      steps: log.reasoningSteps,
    };
  }

  /**
   * 查询单个Skill调用日志详情
   * @param id 日志ID
   * @returns {Promise<Object>} 日志详情
   */
  async getSkillLogById(id: string) {
    const log = await this.prisma.skillInvokeLog.findUnique({
      where: { id: id as any },
    });

    if (!log) {
      throw new Error('Skill调用日志不存在');
    }

    return {
      ...log,
      request: log.params,
      response: log.result,
      skillName: log.skillCode,
    };
  }

  /**
   * 获取调用统计
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(startTime?: string, endTime?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startTime) dateFilter.gte = new Date(startTime);
    if (endTime) dateFilter.lte = new Date(endTime);

    const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // AI调用统计
    const aiTotal = await this.prisma.aiInvokeLog.count({ where });
    const aiSuccess = await this.prisma.aiInvokeLog.count({
      where: { ...where, success: true },
    });
    const aiFailed = aiTotal - aiSuccess;

    // 按模型类型统计
    const modelTypeStats = await this.prisma.aiInvokeLog.groupBy({
      by: ['modelType'],
      where,
      _count: { id: true },
    });

    // 按模型统计
    const modelStats = await this.prisma.aiInvokeLog.groupBy({
      by: ['modelCode'],
      where,
      _count: { id: true },
      _avg: { costMs: true },
    });

    // 技能调用统计
    const skillTotal = await this.prisma.skillInvokeLog.count({ where });
    const skillSuccess = await this.prisma.skillInvokeLog.count({
      where: { ...where, success: true },
    });

    // Agent调用统计
    const agentTotal = await this.prisma.agentInvokeLog.count({ where });
    const agentSuccess = await this.prisma.agentInvokeLog.count({
      where: { ...where, success: true },
    });

    return {
      ai: {
        total: aiTotal,
        success: aiSuccess,
        failed: aiFailed,
        successRate: aiTotal > 0 ? Math.round((aiSuccess / aiTotal) * 10000) / 100 : 0,
      },
      skill: {
        total: skillTotal,
        success: skillSuccess,
        successRate: skillTotal > 0 ? Math.round((skillSuccess / skillTotal) * 10000) / 100 : 0,
      },
      agent: {
        total: agentTotal,
        success: agentSuccess,
        successRate: agentTotal > 0 ? Math.round((agentSuccess / agentTotal) * 10000) / 100 : 0,
      },
      modelTypeStats: modelTypeStats.map((s: { modelType: string; _count: { id: number } }) => ({
        modelType: s.modelType,
        count: s._count.id,
      })),
      modelStats: modelStats.map((s: { modelCode: string; _count: { id: number }; _avg: { costMs: number | null } }) => ({
        modelCode: s.modelCode,
        count: s._count.id,
        avgCostMs: s._avg.costMs ? Math.round(s._avg.costMs) : 0,
      })),
    };
  }
}

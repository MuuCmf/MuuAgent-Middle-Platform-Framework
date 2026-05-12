import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppUsage } from '@prisma/client';

/**
 * 应用使用量服务
 * 
 * 调用次数：由 RateLimitInterceptor 统一记录到 AppUsage.callCount
 * Token统计：从 AiInvokeLog 聚合查询（Agent每次模型调用都已记录在AiInvokeLog中）
 */
@Injectable()
export class AppUsageService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 增加调用次数
   * @param appCode 应用标识
   * @returns {Promise<void>}
   */
  async incrementCallCount(appCode: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.appUsage.upsert({
      where: {
        appCode_date: {
          appCode,
          date: today,
        },
      },
      update: {
        callCount: { increment: 1 },
      },
      create: {
        appCode,
        date: today,
        callCount: 1,
      },
    });
  }

  /**
   * 增加Token使用量（不重复增加调用次数，调用次数由拦截器统一记录）
   * @param appCode 应用标识
   * @param inputTokens 输入Token数
   * @param outputTokens 输出Token数
   * @returns {Promise<void>}
   */
  async incrementTokenCount(
    appCode: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.appUsage.upsert({
      where: {
        appCode_date: {
          appCode,
          date: today,
        },
      },
      update: {
        tokenCount: { increment: inputTokens + outputTokens },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
      },
      create: {
        appCode,
        date: today,
        callCount: 0,
        tokenCount: inputTokens + outputTokens,
        inputTokens,
        outputTokens,
      },
    });
  }

  /**
   * 从 AiInvokeLog 聚合 Token 使用量（最准确的数据源）
   * Agent每次调用模型都会在AiInvokeLog中记录token，无需再从AgentInvokeLog聚合
   * @param appCode 应用标识
   * @param since 起始时间
   * @returns {Promise<{inputTokens: number, outputTokens: number}>} Token统计
   */
  async getTokenUsageFromLogs(
    appCode: string,
    since: Date,
  ): Promise<{ inputTokens: number; outputTokens: number }> {
    const result = await this.prisma.aiInvokeLog.aggregate({
      where: {
        appCode,
        createdAt: { gte: since },
        success: true,
      },
      _sum: { inputTokens: true, outputTokens: true },
    });

    return {
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
    };
  }

  /**
   * 获取今日使用量
   * @param appCode 应用标识
   * @returns {Promise<object>} 使用量信息
   */
  async getTodayUsage(appCode: string): Promise<{
    callCount: number;
    tokenCount: number;
    inputTokens: number;
    outputTokens: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [usage, tokenFromLogs] = await Promise.all([
      this.prisma.appUsage.findUnique({
        where: {
          appCode_date: {
            appCode,
            date: today,
          },
        },
      }),
      this.getTokenUsageFromLogs(appCode, today),
    ]);

    return {
      callCount: usage?.callCount || 0,
      tokenCount: tokenFromLogs.inputTokens + tokenFromLogs.outputTokens,
      inputTokens: tokenFromLogs.inputTokens,
      outputTokens: tokenFromLogs.outputTokens,
    };
  }

  /**
   * 获取月度使用量
   * @param appCode 应用标识
   * @returns {Promise<object>} 月度使用量
   */
  async getMonthlyUsage(appCode: string): Promise<{
    callCount: number;
    tokenCount: number;
    inputTokens: number;
    outputTokens: number;
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [usages, tokenFromLogs] = await Promise.all([
      this.prisma.appUsage.findMany({
        where: {
          appCode,
          date: { gte: firstDayOfMonth },
        },
      }),
      this.getTokenUsageFromLogs(appCode, firstDayOfMonth),
    ]);

    const callCount = usages.reduce((acc, u) => acc + u.callCount, 0);

    return {
      callCount,
      tokenCount: tokenFromLogs.inputTokens + tokenFromLogs.outputTokens,
      inputTokens: tokenFromLogs.inputTokens,
      outputTokens: tokenFromLogs.outputTokens,
    };
  }

  /**
   * 获取使用量历史
   * @param appCode 应用标识
   * @param days 天数
   * @returns {Promise<Array>} 使用量历史
   */
  async getUsageHistory(
    appCode: string,
    days: number = 30,
  ): Promise<Array<{
    date: Date;
    callCount: number;
    tokenCount: number;
    inputTokens: number;
    outputTokens: number;
  }>> {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const usages = await this.prisma.appUsage.findMany({
      where: {
        appCode,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    return usages.map((usage: AppUsage) => ({
      date: usage.date,
      callCount: usage.callCount,
      tokenCount: usage.tokenCount,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }));
  }
}

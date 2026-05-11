import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppUsage } from '@prisma/client';

/**
 * 应用使用量服务
 * 
 * 提供应用使用量的记录和查询功能
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
   * 增加Token使用量
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
        callCount: { increment: 1 },
        tokenCount: { increment: inputTokens + outputTokens },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
      },
      create: {
        appCode,
        date: today,
        callCount: 1,
        tokenCount: inputTokens + outputTokens,
        inputTokens,
        outputTokens,
      },
    });
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

    const usage = await this.prisma.appUsage.findUnique({
      where: {
        appCode_date: {
          appCode,
          date: today,
        },
      },
    });

    return {
      callCount: usage?.callCount || 0,
      tokenCount: usage?.tokenCount || 0,
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
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

    const usages = await this.prisma.appUsage.findMany({
      where: {
        appCode,
        date: { gte: firstDayOfMonth },
      },
    });

    return usages.reduce(
      (acc: { callCount: number; tokenCount: number; inputTokens: number; outputTokens: number }, usage: AppUsage) => ({
        callCount: acc.callCount + usage.callCount,
        tokenCount: acc.tokenCount + usage.tokenCount,
        inputTokens: acc.inputTokens + usage.inputTokens,
        outputTokens: acc.outputTokens + usage.outputTokens,
      }),
      { callCount: 0, tokenCount: 0, inputTokens: 0, outputTokens: 0 },
    );
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

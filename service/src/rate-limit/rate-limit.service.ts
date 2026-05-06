import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * 限流级别枚举
 */
export enum RateLimitLevel {
  GLOBAL = 'global',
  APP = 'app',
  INTERFACE = 'interface',
  MODEL = 'model',
}

/**
 * 限流检查结果接口
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  currentQps?: number;
  currentConcurrent?: number;
  remainingQuota?: number;
}

/**
 * 令牌桶状态接口
 */
interface TokenBucket {
  tokens: number;
  lastUpdate: Date;
}

/**
 * 限流服务
 * 实现多级别限流、令牌桶算法、并发控制、队列管理
 */
@Injectable()
export class RateLimitService {
  /** 令牌桶缓存 */
  private tokenBuckets: Map<string, TokenBucket> = new Map();

  /** 请求队列 */
  private requestQueues: Map<string, Array<() => Promise<void>>> = new Map();

  /** 并发计数器 */
  private concurrentCounters: Map<string, number> = new Map();

  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 检查限流
   * @param level 限流级别
   * @param target 限流目标
   * @param clientIp 客户端IP
   * @returns {Promise<RateLimitResult>} 限流检查结果
   */
  async checkRateLimit(
    level: RateLimitLevel,
    target: string,
    clientIp?: string,
  ): Promise<RateLimitResult> {
    const rule = await this.getRule(level, target);

    if (!rule || !rule.status) {
      return { allowed: true };
    }

    // 检查黑名单
    if (clientIp && (await this.isBlacklisted(clientIp))) {
      return {
        allowed: false,
        reason: 'IP已被封禁',
      };
    }

    // 获取计数器
    const counter = await this.getCounter(rule.id);

    // 检查每日限额
    if (rule.dailyLimit > 0 && counter.todayCount >= rule.dailyLimit) {
      return {
        allowed: false,
        reason: '已超过每日调用限额',
        remainingQuota: 0,
      };
    }

    // 检查并发限制
    if (rule.concurrentLimit > 0) {
      const concurrentResult = await this.checkConcurrent(rule.id, rule.concurrentLimit);
      if (!concurrentResult.allowed) {
        return concurrentResult;
      }
    }

    // 检查QPS限制（令牌桶算法）
    if (rule.qpsLimit > 0) {
      const qpsResult = await this.checkQps(rule.id, rule.qpsLimit, rule.burstSize);
      if (!qpsResult.allowed) {
        return qpsResult;
      }
    }

    // 通过所有检查，增加计数
    await this.incrementCounter(rule.id);

    return {
      allowed: true,
      currentQps: counter.currentQps,
      currentConcurrent: counter.currentConcurrent,
      remainingQuota: rule.dailyLimit > 0 ? rule.dailyLimit - counter.todayCount - 1 : undefined,
    };
  }

  /**
   * 获取限流规则
   * @param level 限流级别
   * @param target 限流目标
   * @returns {Promise<Object|null>} 限流规则
   */
  private async getRule(level: RateLimitLevel, target: string) {
    let rule = await this.prisma.rateLimitRule.findFirst({
      where: { level, target },
    });

    if (!rule && level !== RateLimitLevel.GLOBAL) {
      rule = await this.prisma.rateLimitRule.findFirst({
        where: { level: RateLimitLevel.GLOBAL, target: 'global' },
      });
    }

    return rule;
  }

  /**
   * 获取计数器
   * @param ruleId 规则ID
   * @returns {Promise<Object>} 计数器
   */
  private async getCounter(ruleId: string) {
    let counter = await this.prisma.rateLimitCounter.findFirst({
      where: { ruleId },
    });

    if (!counter) {
      counter = await this.prisma.rateLimitCounter.create({
        data: { ruleId },
      });
    }

    // 检查是否需要重置每日计数
    const today = new Date().toISOString().split('T')[0];
    if (counter.lastResetDate !== today) {
      counter = await this.prisma.rateLimitCounter.update({
        where: { id: counter.id },
        data: {
          todayCount: 0,
          lastResetDate: today,
        },
      });
    }

    return counter;
  }

  /**
   * 检查并发限制
   * @param ruleId 规则ID
   * @param limit 并发限制
   * @returns {Promise<RateLimitResult>} 检查结果
   */
  private async checkConcurrent(ruleId: string, limit: number): Promise<RateLimitResult> {
    const current = this.concurrentCounters.get(ruleId) || 0;

    if (current >= limit) {
      return {
        allowed: false,
        reason: '并发数已达上限',
        currentConcurrent: current,
      };
    }

    return { allowed: true, currentConcurrent: current };
  }

  /**
   * 检查QPS限制（令牌桶算法）
   * @param ruleId 规则ID
   * @param qpsLimit QPS限制
   * @param burstSize 突发流量大小
   * @returns {Promise<RateLimitResult>} 检查结果
   */
  private async checkQps(
    ruleId: string,
    qpsLimit: number,
    burstSize: number,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const bucket = this.tokenBuckets.get(ruleId) || {
      tokens: burstSize,
      lastUpdate: now,
    };

    // 计算令牌补充
    const timePassed = (now.getTime() - bucket.lastUpdate.getTime()) / 1000;
    const tokensToAdd = timePassed * qpsLimit;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, burstSize);
    bucket.lastUpdate = now;

    // 检查是否有令牌
    if (bucket.tokens < 1) {
      const waitTime = Math.ceil((1 - bucket.tokens) / qpsLimit);
      this.tokenBuckets.set(ruleId, bucket);

      return {
        allowed: false,
        reason: 'QPS限流',
        retryAfter: waitTime,
        currentQps: qpsLimit,
      };
    }

    // 消耗一个令牌
    bucket.tokens -= 1;
    this.tokenBuckets.set(ruleId, bucket);

    return { allowed: true };
  }

  /**
   * 增加计数器
   * @param ruleId 规则ID
   * @returns {Promise<void>}
   */
  private async incrementCounter(ruleId: string): Promise<void> {
    const counter = await this.getCounter(ruleId);
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    // 更新QPS计数
    let currentQps = counter.currentQps;
    if (counter.lastSecond !== currentSecond) {
      currentQps = 1;
    } else {
      currentQps += 1;
    }

    // 更新并发计数
    const currentConcurrent = (this.concurrentCounters.get(ruleId) || 0) + 1;
    this.concurrentCounters.set(ruleId, currentConcurrent);

    await this.prisma.rateLimitCounter.update({
      where: { id: counter.id },
      data: {
        currentQps,
        currentConcurrent,
        todayCount: counter.todayCount + 1,
        lastSecond: currentSecond,
      },
    });
  }

  /**
   * 释放并发计数
   * @param ruleId 规则ID
   * @returns {Promise<void>}
   */
  async releaseConcurrent(ruleId: string): Promise<void> {
    const current = this.concurrentCounters.get(ruleId) || 0;
    if (current > 0) {
      this.concurrentCounters.set(ruleId, current - 1);

      const counter = await this.getCounter(ruleId);
      await this.prisma.rateLimitCounter.update({
        where: { id: counter.id },
        data: {
          currentConcurrent: current - 1,
        },
      });
    }
  }

  /**
   * 检查是否在黑名单中
   * @param clientIp 客户端IP
   * @returns {Promise<boolean>} 是否在黑名单
   */
  private async isBlacklisted(clientIp: string): Promise<boolean> {
    const now = new Date();
    const blacklist = await this.prisma.rateLimitBlacklist.findFirst({
      where: {
        clientIp,
        blockUntil: { gte: now },
      },
    });

    return !!blacklist;
  }

  /**
   * 添加到黑名单
   * @param clientIp 客户端IP
   * @param reason 原因
   * @param duration 封禁时长(秒)
   * @returns {Promise<void>}
   */
  async addToBlacklist(clientIp: string, reason: string, duration: number = 3600): Promise<void> {
    const blockUntil = new Date(Date.now() + duration * 1000);

    await this.prisma.rateLimitBlacklist.create({
      data: {
        clientIp,
        reason,
        blockUntil,
      },
    });
  }

  /**
   * 创建或更新限流规则
   * @param level 限流级别
   * @param target 限流目标
   * @param config 规则配置
   * @returns {Promise<Object>} 创建或更新的规则
   */
  async upsertRule(
    level: RateLimitLevel,
    target: string,
    config: {
      qpsLimit?: number;
      concurrentLimit?: number;
      dailyLimit?: number;
      burstSize?: number;
      enableQueue?: boolean;
      queueSize?: number;
      queueTimeout?: number;
    },
  ) {
    return this.prisma.rateLimitRule.upsert({
      where: {
        level_target: { level, target },
      },
      update: config,
      create: {
        level,
        target,
        ...config,
      },
    });
  }

  /**
   * 获取所有限流规则
   * @returns {Promise<Array>} 规则列表
   */
  async getAllRules() {
    return this.prisma.rateLimitRule.findMany({
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 获取限流统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    const rules = await this.prisma.rateLimitRule.findMany({
      include: {
        rateLimitCounters: true,
      },
    });

    return rules.map((rule) => ({
      level: rule.level,
      target: rule.target,
      qpsLimit: rule.qpsLimit,
      concurrentLimit: rule.concurrentLimit,
      dailyLimit: rule.dailyLimit,
      currentQps: rule.rateLimitCounters?.[0]?.currentQps || 0,
      currentConcurrent: rule.rateLimitCounters?.[0]?.currentConcurrent || 0,
      todayCount: rule.rateLimitCounters?.[0]?.todayCount || 0,
    }));
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * 缓存服务
 * 提供统一的缓存操作接口
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  /**
   * 构造函数
   * @param cacheManager 缓存管理器
   */
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（毫秒）
   * @returns {Promise<void>}
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns {Promise<any>} 缓存值
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    return (await this.cacheManager.get(key)) as T | undefined;
  }

  /**
   * 原子化的"获取或计算"操作，防止缓存击穿
   *
   * 使用 Redis SETNX 实现分布式锁：缓存未命中时，只有一个请求执行 factory，
   * 其余请求轮询等待缓存结果，避免并发穿透到下游（embedding/向量检索）。
   *
   * @param key 缓存键
   * @param factory 缓存未命中时的计算函数
   * @param ttl 缓存过期时间（毫秒）
   * @returns 缓存值或计算值
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined && cached !== null) return cached;

    const lockKey = `${key}:lock`;
    const client = this.getRedisClient();

    if (client?.set) {
      // 尝试获取分布式锁，锁 TTL 10 秒防止死锁
      const locked = await client.set(lockKey, '1', 'PX', 10000, 'NX');
      if (!locked) {
        // 未获取到锁，轮询等待持锁者写入缓存
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const result = await this.get<T>(key);
          if (result !== undefined && result !== null) {
            return result;
          }
        }
        this.logger.warn(`缓存等待超时，降级自行计算: ${key}`);
      }
    }

    try {
      const result = await factory();
      await this.set(key, result, ttl);
      return result;
    } finally {
      if (client?.del) {
        await client.del(lockKey).catch(() => {});
      }
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   * @returns {Promise<void>}
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * 清空所有缓存
   * @returns {Promise<void>}
   */
  async reset(): Promise<void> {
    // 尝试使用底层 store 的 flushall 方法
    const store = this.cacheManager as any;
    if (store.store && typeof store.store.flushall === 'function') {
      await store.store.flushall();
    } else if (store.client && typeof store.client.flushAll === 'function') {
      await store.client.flushAll();
    }
  }

  /**
   * 生成检索缓存键
   * @param kbId 知识库ID
   * @param query 查询内容
   * @param topN 召回数量
   * @param similarityThresh 相似度阈值
   * @returns {string} 缓存键
   */
  getRetrievalCacheKey(
    kbId: string,
    query: string,
    topN: number,
    similarityThresh: number,
  ): string {
    return `retrieval:${kbId}:${this.hashString(query)}:${topN}:${similarityThresh}`;
  }

  /**
   * 生成知识库缓存键
   * @param kbId 知识库ID
   * @returns {string} 缓存键
   */
  getKbCacheKey(kbId: string): string {
    return `kb:${kbId}`;
  }

  /**
   * 字符串哈希函数
   * @param str 输入字符串
   * @returns {number} 哈希值
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 设置检索结果缓存
   * @param kbId 知识库ID
   * @param query 查询内容
   * @param topN 召回数量
   * @param similarityThresh 相似度阈值
   * @param result 检索结果
   * @param ttl 过期时间（毫秒）
   * @returns {Promise<void>}
   */
  async setRetrievalCache(
    kbId: string,
    query: string,
    topN: number,
    similarityThresh: number,
    result: any,
    ttl: number = 3600000, // 1小时
  ): Promise<void> {
    const key = this.getRetrievalCacheKey(kbId, query, topN, similarityThresh);
    await this.set(key, result, ttl);
  }

  /**
   * 获取检索结果缓存
   * @param kbId 知识库ID
   * @param query 查询内容
   * @param topN 召回数量
   * @param similarityThresh 相似度阈值
   * @returns {Promise<any | undefined>} 缓存的检索结果
   */
  async getRetrievalCache(
    kbId: string,
    query: string,
    topN: number,
    similarityThresh: number,
  ): Promise<any | undefined> {
    const key = this.getRetrievalCacheKey(kbId, query, topN, similarityThresh);
    return this.get(key);
  }

  /**
   * 获取 Redis 客户端（用于执行 SCAN 等原生命令）
   */
  private getRedisClient(): any | null {
    const store = (this.cacheManager as any).store;
    return store?.client || store?.getClient?.() || null;
  }

  /**
   * 清除指定知识库的所有缓存（包括检索结果缓存）
   * 使用 Redis SCAN 命令遍历删除 retrieval:{kbId}:* 键
   * @param kbId 知识库ID
   * @returns {Promise<void>}
   */
  async clearKbCache(kbId: string): Promise<void> {
    const client = this.getRedisClient();

    if (client?.scan) {
      const pattern = `retrieval:${kbId}:*`;
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await Promise.all(keys.map((k: string) => this.del(k)));
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      this.logger.log(
        `已清除知识库 ${kbId} 的检索缓存，共 ${deletedCount} 个键`,
      );
    }

    // 同时删除知识库基本信息缓存
    const kbKey = this.getKbCacheKey(kbId);
    await this.del(kbKey);
  }
}

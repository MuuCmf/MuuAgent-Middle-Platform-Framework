import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * 缓存服务
 * 提供统一的缓存操作接口
 */
@Injectable()
export class CacheService {
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
  async get(key: string): Promise<any> {
    return await this.cacheManager.get(key);
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
   * 清除指定知识库的所有缓存
   * @param kbId 知识库ID
   * @returns {Promise<void>}
   */
  async clearKbCache(kbId: string): Promise<void> {
    // 由于Redis不支持通配符删除，这里需要维护一个知识库缓存键列表
    // 实际实现中可以使用Redis的SCAN命令来查找相关键
    // 这里简化处理，只删除知识库基本信息缓存
    const kbKey = this.getKbCacheKey(kbId);
    await this.del(kbKey);
  }
}

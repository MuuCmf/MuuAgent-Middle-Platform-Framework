import { Logger } from '@nestjs/common';

/**
 * 缓存项接口
 */
interface CacheEntry<T> {
  /** 缓存数据 */
  data: T;
  /** 过期时间戳 */
  expireAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后访问时间戳 */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  /** 当前缓存项数量 */
  size: number;
  /** 最大缓存项数量 */
  maxSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 (0-1) */
  hitRate: number;
  /** 淘汰次数 */
  evictions: number;
  /** 过期清理次数 */
  expirations: number;
  /** 总请求数 */
  totalRequests: number;
  /** 平均访问次数 */
  avgAccessCount: number;
  /** 内存使用估算 (字节) */
  estimatedMemoryUsage: number;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 最大缓存项数量 */
  maxSize: number;
  /** 默认TTL (毫秒) */
  defaultTtl: number;
  /** 是否启用统计 */
  enableStats: boolean;
  /** 清理间隔 (毫秒), 0表示禁用自动清理 */
  cleanupInterval: number;
}

/**
 * 默认缓存配置
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 1000,
  defaultTtl: 60000,
  enableStats: true,
  cleanupInterval: 300000,
};

/**
 * LRU缓存管理器
 * 
 * 特性：
 * - LRU (Least Recently Used) 淘汰策略
 * - TTL过期机制
 * - 缓存统计监控
 * - 自动清理过期项
 * - 内存使用估算
 * 
 * @example
 * ```ts
 * const cache = new LruCache<string, any>({ maxSize: 500, defaultTtl: 60000 });
 * 
 * cache.set('key', { data: 'value' });
 * const result = cache.get('key');
 * const stats = cache.getStats();
 * ```
 */
export class LruCache<K = string, V = unknown> {
  private readonly logger = new Logger(LruCache.name);
  private readonly cache = new Map<K, CacheEntry<V>>();
  private readonly config: CacheConfig;
  
  /** 统计数据 */
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  /** 清理定时器 */
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值，不存在或已过期返回 undefined
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.recordMiss();
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.recordHit();

    this.moveToEnd(key);

    return entry.data;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl TTL (毫秒)，不指定则使用默认值
   */
  set(key: K, value: V, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl ?? this.config.defaultTtl;

    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      expireAt: now + effectiveTtl,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    });
  }

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否删除成功
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
    this.logger.log('缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalAccessCount = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      totalRequests,
      avgAccessCount: entries.length > 0 ? totalAccessCount / entries.length : 0,
      estimatedMemoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * 获取所有键
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 手动清理过期缓存
   * @returns 清理的缓存项数量
   */
  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expireAt <= now) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.stats.expirations += count;
      this.logger.debug(`清理了 ${count} 个过期缓存项`);
    }

    return count;
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * 获取或设置缓存 (原子操作)
   * @param key 缓存键
   * @param factory 缓存未命中时的工厂函数
   * @param ttl TTL
   */
  async getOrSet(key: K, factory: () => Promise<V>, ttl?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expireAt <= Date.now();
  }

  /**
   * 淘汰最近最少使用的缓存项
   */
  private evictLRU(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.logger.debug(`LRU淘汰缓存项: ${String(oldestKey)}`);
    }
  }

  /**
   * 将缓存项移动到末尾 (Map保持插入顺序)
   */
  private moveToEnd(key: K): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
  }

  /**
   * 记录命中
   */
  private recordHit(): void {
    if (this.config.enableStats) {
      this.stats.hits++;
    }
  }

  /**
   * 记录未命中
   */
  private recordMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
    }
  }

  /**
   * 重置统计数据
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  /**
   * 启动自动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      const keySize = this.estimateSize(key);
      const entryOverhead = 64;
      const dataSize = this.estimateSize(entry.data);
      totalSize += keySize + entryOverhead + dataSize;
    }

    return totalSize;
  }

  /**
   * 估算值的大小
   */
  private estimateSize(value: unknown): number {
    if (value === null || value === undefined) return 8;
    
    switch (typeof value) {
      case 'number': return 8;
      case 'boolean': return 4;
      case 'string': return (value as string).length * 2;
      case 'object':
        try {
          return JSON.stringify(value).length * 2;
        } catch {
          return 1024;
        }
      default:
        return 64;
    }
  }
}

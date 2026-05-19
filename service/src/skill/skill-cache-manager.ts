import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { SkillMetadata, SkillDescriptor } from './skill-registry';

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  L1_TTL: 30 * 60 * 1000, // L1：技能元数据列表，30分钟
  L2_TTL: 5 * 60 * 1000,  // L2：完整技能描述符，5分钟
  L3_TTL: 60 * 60 * 1000, // L3：参考文档内容，1小时
  L2_MAX_SIZE: 1000,
};

/**
 * 缓存键生成
 */
const CacheKeys = {
  l1MetadataList: (appCode?: string) => `skill:l1:metadata:${appCode || 'all'}`,
  l2Descriptor: (name: string) => `skill:l2:descriptor:${name}`,
  l3Reference: (skillName: string, path: string) => `skill:l3:reference:${skillName}:${path}`,
};

/**
 * 技能缓存管理器
 *
 * 封装三级缓存：
 * - L1（Redis）：技能元数据列表
 * - L2（内存 LRU + Redis）：完整技能描述符
 * - L3（Redis）：参考文档内容
 *
 * 通过追踪已设置的键来实现精确清除，避免 reset() 误伤其他缓存。
 */
@Injectable()
export class SkillCacheManager {
  private readonly logger = new Logger(SkillCacheManager.name);

  /** L2 内存缓存（LRU） */
  private readonly l2Cache = new Map<string, { descriptor: SkillDescriptor; timestamp: number }>();

  /** 追踪已写入 Redis 的 L1 键 */
  private trackedL1Keys = new Set<string>();
  /** 追踪已写入 Redis 的 L2 键 */
  private trackedL2Keys = new Set<string>();
  /** 追踪已写入 Redis 的 L3 键 */
  private trackedL3Keys = new Set<string>();

  constructor(private readonly cacheService: CacheService) {}

  // ================================================================
  // L1：技能元数据列表
  // ================================================================

  async getL1Metadata(appCode?: string): Promise<SkillMetadata[] | null> {
    const key = CacheKeys.l1MetadataList(appCode);
    const cached = await this.cacheService.get(key);
    if (cached) {
      this.logger.debug(`L1缓存命中: ${key}`);
    }
    return cached ?? null;
  }

  async setL1Metadata(appCode: string | undefined, data: SkillMetadata[]): Promise<void> {
    const key = CacheKeys.l1MetadataList(appCode);
    this.trackedL1Keys.add(key);
    await this.cacheService.set(key, data, CACHE_CONFIG.L1_TTL);
  }

  // ================================================================
  // L2：完整技能描述符（内存 LRU + Redis）
  // ================================================================

  getL2Descriptor(name: string): SkillDescriptor | null {
    const entry = this.l2Cache.get(name);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_CONFIG.L2_TTL) {
      this.l2Cache.delete(name);
      return null;
    }
    return entry.descriptor;
  }

  async getL2DescriptorFromRedis(name: string): Promise<SkillDescriptor | null> {
    const key = CacheKeys.l2Descriptor(name);
    const cached = await this.cacheService.get(key);
    if (cached) {
      // 回填内存缓存
      this.setL2Descriptor(name, cached);
    }
    return cached ?? null;
  }

  setL2Descriptor(name: string, descriptor: SkillDescriptor): void {
    this.addToL2Cache(name, descriptor);
  }

  async setL2DescriptorWithRedis(name: string, descriptor: SkillDescriptor): Promise<void> {
    this.addToL2Cache(name, descriptor);
    const key = CacheKeys.l2Descriptor(name);
    this.trackedL2Keys.add(key);
    await this.cacheService.set(key, descriptor, CACHE_CONFIG.L2_TTL);
  }

  // ================================================================
  // L3：参考文档内容
  // ================================================================

  async getL3Reference(skillName: string, referencePath: string): Promise<string | null> {
    const key = CacheKeys.l3Reference(skillName, referencePath);
    const cached = await this.cacheService.get(key);
    if (cached) {
      this.logger.debug(`L3缓存命中: ${skillName}/${referencePath}`);
    }
    return cached ?? null;
  }

  async setL3Reference(skillName: string, referencePath: string, content: string): Promise<void> {
    const key = CacheKeys.l3Reference(skillName, referencePath);
    this.trackedL3Keys.add(key);
    await this.cacheService.set(key, content, CACHE_CONFIG.L3_TTL);
  }

  // ================================================================
  // 缓存失效
  // ================================================================

  /** 清除指定技能的 L2 缓存 */
  invalidate(name: string): void {
    this.l2Cache.delete(name);
    const key = CacheKeys.l2Descriptor(name);
    this.cacheService.del(key);
    this.trackedL2Keys.delete(key);
    this.logger.debug(`已清除技能 ${name} 的 L2 缓存`);
  }

  /** 清除所有技能缓存（精确删除，不误伤其他缓存） */
  async clearAll(): Promise<void> {
    this.l2Cache.clear();

    const deletions: Promise<void>[] = [];
    for (const key of this.trackedL1Keys) deletions.push(this.cacheService.del(key));
    for (const key of this.trackedL2Keys) deletions.push(this.cacheService.del(key));
    for (const key of this.trackedL3Keys) deletions.push(this.cacheService.del(key));

    await Promise.all(deletions);

    this.trackedL1Keys.clear();
    this.trackedL2Keys.clear();
    this.trackedL3Keys.clear();

    this.logger.log(`已清除所有技能缓存（L1 + L2 + L3），共 ${deletions.length} 个键`);
  }

  /** 清除 L1 元数据列表缓存 */
  async invalidateL1(appCode?: string): Promise<void> {
    const key = CacheKeys.l1MetadataList(appCode);
    await this.cacheService.del(key);
    this.trackedL1Keys.delete(key);
    this.logger.debug(`已清除 L1 缓存: ${key}`);
  }

  // ================================================================
  // 统计
  // ================================================================

  getStats() {
    return {
      l2CacheSize: this.l2Cache.size,
      trackedL1Keys: this.trackedL1Keys.size,
      trackedL2Keys: this.trackedL2Keys.size,
      trackedL3Keys: this.trackedL3Keys.size,
      cacheConfig: CACHE_CONFIG,
    };
  }

  // ================================================================
  // 内部 LRU
  // ================================================================

  private addToL2Cache(name: string, descriptor: SkillDescriptor): void {
    if (this.l2Cache.size >= CACHE_CONFIG.L2_MAX_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.l2Cache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.l2Cache.delete(oldestKey);
      }
    }
    this.l2Cache.set(name, { descriptor, timestamp: Date.now() });
  }
}

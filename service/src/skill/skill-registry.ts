import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { DatabaseSkillProvider } from './standard/database-skill-provider';
import { SkillFrontmatter } from './standard/skill-md-validator';
import { IsolationContext } from '../common/services/base-isolated.service';
import { CacheService } from '../cache/cache.service';

/**
 * 技能元数据（L1 层，始终驻留）
 */
export interface SkillMetadata {
  name: string;
  description: string;
  source: 'filesystem' | 'database';
  type?: string;
  appCode?: string | null;
  isPublic: boolean;
  hasReferences: boolean;
  hasScripts: boolean;
}

/**
 * 技能完整描述（L1 + L2 层）
 */
export interface SkillDescriptor {
  metadata: SkillMetadata;
  instructions: string;
  frontmatter?: SkillFrontmatter;
  allowedTools?: string[];
  executionConfig?: {
    type: string;
    config: Record<string, unknown>;
    params: Record<string, unknown>;
  };
}

/**
 * 技能数据提供者接口
 * 
 * 所有 Provider 必须实现 listAll 和 resolve 方法。
 * references 相关方法是可选的，通过 supportsReferences() 声明是否支持。
 */
export interface ISkillProvider {
  /**
   * 列出所有可用技能的元数据
   * @param context 隔离上下文
   * @returns 技能元数据列表
   */
  listAll(context?: IsolationContext): Promise<SkillMetadata[]>;

  /**
   * 解析完整技能描述符
   * @param name 技能名称
   * @param context 隔离上下文
   * @returns 技能描述符，不存在则返回 null
   */
  resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null>;

  /**
   * 是否支持 references 功能
   * @returns true 表示支持 loadReference 和 listReferences
   */
  supportsReferences?(): boolean;

  /**
   * 加载参考文档内容
   * @param skillName 技能名称
   * @param referencePath 参考文档路径
   * @returns 文档内容
   */
  loadReference?(skillName: string, referencePath: string): Promise<string>;

  /**
   * 列出技能的所有参考文档
   * @param skillName 技能名称
   * @returns 参考文档路径列表
   */
  listReferences?(skillName: string): Promise<string[]>;
}

/**
 * 缓存配置常量
 */
const CACHE_CONFIG = {
  L1_TTL: 30 * 60 * 1000, // L1缓存TTL：30分钟（技能元数据列表）
  L2_TTL: 5 * 60 * 1000,  // L2缓存TTL：5分钟（完整技能描述符）
  L3_TTL: 60 * 60 * 1000, // L3缓存TTL：1小时（参考文档内容）
  L2_MAX_SIZE: 1000,       // L2缓存最大条目数
};

/**
 * 缓存键生成器
 */
const CacheKeys = {
  l1MetadataList: (appCode?: string) => `skill:l1:metadata:${appCode || 'all'}`,
  l2Descriptor: (name: string) => `skill:l2:descriptor:${name}`,
  l3Reference: (skillName: string, path: string) => `skill:l3:reference:${skillName}:${path}`,
};

/**
 * 统一技能注册中心
 * 
 * 实现三层缓存架构：
 * - L1层：技能元数据列表（Redis缓存，TTL 30分钟）
 * - L2层：完整技能描述符（内存LRU缓存，TTL 5分钟）
 * - L3层：参考文档内容（Redis缓存，TTL 1小时）
 * 
 * Provider查询顺序：Database -> Filesystem（回源）
 */
@Injectable()
export class SkillRegistry implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistry.name);
  private readonly providers: ISkillProvider[] = [];
  
  // L2缓存：已解析的完整技能描述符（内存LRU）
  private readonly l2Cache = new Map<string, {
    descriptor: SkillDescriptor;
    timestamp: number;
  }>();

  constructor(
    private readonly skillScanner: SkillScanner,
    private readonly fileSkillProvider: FileSkillProvider,
    private readonly databaseSkillProvider: DatabaseSkillProvider,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // 注册Provider：数据库优先，文件系统作为回源
    this.registerProvider(this.databaseSkillProvider);
    this.registerProvider(this.fileSkillProvider);
    this.logger.log(`技能注册中心已初始化，共 ${this.providers.length} 个 Provider`);
  }

  /**
   * 注册自定义 Provider
   */
  registerProvider(provider: ISkillProvider): void {
    this.providers.push(provider);
  }

  /**
   * 列出所有可用技能的 L1 元数据
   * 按注册顺序遍历，同名技能先注册的优先
   * 
   * 缓存策略：
   * - 优先从Redis获取L1缓存
   * - 缓存未命中时，从Provider获取并写入缓存
   */
  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const cacheKey = CacheKeys.l1MetadataList(context?.appCode ?? undefined);
    
    // 尝试从Redis获取缓存
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`L1缓存命中: ${cacheKey}`);
      return cached;
    }

    // 缓存未命中，从Provider获取
    const seen = new Set<string>();
    const results: SkillMetadata[] = [];

    for (const provider of this.providers) {
      try {
        const list = await provider.listAll(context);
        for (const item of list) {
          if (!seen.has(item.name)) {
            seen.add(item.name);
            results.push(item);
          }
        }
      } catch (err) {
        this.logger.warn(`Provider listAll 失败: ${(err as Error).message}`);
      }
    }

    // 写入Redis缓存
    await this.cacheService.set(cacheKey, results, CACHE_CONFIG.L1_TTL);

    return results;
  }

  /**
   * 解析完整技能描述（L1 + L2）
   * 按 Provider 注册顺序查找，第一个返回非 null 结果的为准
   * 
   * 缓存策略：
   * - 优先从L2内存缓存获取
   * - L2未命中时从Redis获取
   * - 都未命中时从Provider获取并写入两级缓存
   */
  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const cacheKey = CacheKeys.l2Descriptor(name);

    // 1. 优先从L2内存缓存获取
    const l2Cached = this.getFromL2Cache(name);
    if (l2Cached) {
      this.logger.debug(`L2缓存命中: ${name}`);
      return l2Cached;
    }

    // 2. 从Redis获取
    const redisCached = await this.cacheService.get(cacheKey);
    if (redisCached) {
      this.logger.debug(`Redis L2缓存命中: ${name}`);
      // 同时写入内存缓存
      this.addToL2Cache(name, redisCached);
      return redisCached;
    }

    // 3. 从Provider获取
    for (const provider of this.providers) {
      try {
        const descriptor = await provider.resolve(name, context);
        if (descriptor) {
          // 写入两级缓存
          this.addToL2Cache(name, descriptor);
          await this.cacheService.set(cacheKey, descriptor, CACHE_CONFIG.L2_TTL);
          return descriptor;
        }
      } catch (err) {
        this.logger.warn(`Provider resolve("${name}") 失败: ${(err as Error).message}`);
      }
    }
    
    return null;
  }

  /**
   * 按名称查找单个技能元数据
   */
  async findByName(name: string, context?: IsolationContext): Promise<SkillMetadata | null> {
    const all = await this.listAll(context);
    return all.find(s => s.name === name) || null;
  }

  /**
   * 加载 references/ 中的指定文档（L3）
   * 
   * 缓存策略：
   * - 优先从Redis获取
   * - 未命中时从Provider获取并写入缓存
   * 
   * @param skillName 技能名称
   * @param referencePath 参考文档路径
   * @returns 文档内容
   */
  async loadReference(skillName: string, referencePath: string): Promise<string> {
    const cacheKey = CacheKeys.l3Reference(skillName, referencePath);
    
    // 尝试从Redis获取缓存
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`L3缓存命中: ${skillName}/${referencePath}`);
      return cached;
    }

    // 从Provider获取
    for (const provider of this.providers) {
      if (provider.supportsReferences?.() && provider.loadReference) {
        try {
          const content = await provider.loadReference(skillName, referencePath);
          // 写入Redis缓存
          await this.cacheService.set(cacheKey, content, CACHE_CONFIG.L3_TTL);
          return content;
        } catch {
          // 继续尝试下一个 provider
        }
      }
    }
    throw new Error(`技能 ${skillName} 不存在或没有 references 支持`);
  }

  /**
   * 列出 references/ 目录
   * @param skillName 技能名称
   * @returns 参考文档路径列表
   */
  async listReferences(skillName: string): Promise<string[]> {
    for (const provider of this.providers) {
      if (provider.supportsReferences?.() && provider.listReferences) {
        try {
          return await provider.listReferences(skillName);
        } catch {
          // continue
        }
      }
    }
    return [];
  }

  /**
   * 获取文件系统技能的目录路径
   * 仅对 source='filesystem' 的技能有效
   * @param name 技能名称
   * @returns 技能目录路径，如果技能不存在或不是文件系统技能则返回 null
   */
  getSkillDirectory(name: string): string | null {
    const entry = this.skillScanner.findByName(name);
    return entry?.directoryPath || null;
  }

  /**
   * 检查技能是否有脚本目录
   * @param name 技能名称
   * @returns 是否有 scripts/ 目录
   */
  hasScripts(name: string): boolean {
    const entry = this.skillScanner.findByName(name);
    return entry?.hasScripts || false;
  }

  /**
   * 刷新文件系统技能索引并同步到数据库
   * @returns 刷新结果，包含扫描数量、同步数量、错误数和耗时
   */
  async refresh(): Promise<{
    scanned: number;
    synced: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const scanResult = await this.skillScanner.scan();
    
    const entries = await this.skillScanner.buildSyncEntries();
    let synced = 0;
    if (entries.length > 0) {
      await this.databaseSkillProvider.syncFromFilesystem(entries);
      synced = entries.length;
    }
    
    this.clearAllCache();
    
    const duration = Date.now() - startTime;
    this.logger.log(`技能索引已刷新，数据库已同步，缓存已清除，耗时 ${duration}ms`);
    
    return {
      scanned: this.skillScanner.getIndex().length,
      synced,
      errors: scanResult.errors.length,
      duration,
    };
  }

  /**
   * 将文件系统技能同步到数据库
   * @returns 同步的技能数量
   */
  async syncToDatabase(): Promise<number> {
    const entries = await this.skillScanner.buildSyncEntries();
    if (entries.length > 0) {
      await this.databaseSkillProvider.syncFromFilesystem(entries);
    }
    return entries.length;
  }

  /**
   * 获取技能统计信息
   * @returns 统计信息
   */
  getStats(): {
    filesystemSkills: number;
    l2CacheSize: number;
    cacheConfig: typeof CACHE_CONFIG;
  } {
    return {
      filesystemSkills: this.skillScanner.getIndex().length,
      l2CacheSize: this.l2Cache.size,
      cacheConfig: CACHE_CONFIG,
    };
  }

  /**
   * 清除指定技能的所有缓存（L1 + L2 + L3）
   * @param name 技能名称
   */
  invalidateCache(name: string): void {
    // 清除L2内存缓存
    this.l2Cache.delete(name);
    
    // 清除Redis L2缓存
    const descriptorKey = CacheKeys.l2Descriptor(name);
    this.cacheService.del(descriptorKey);
    
    // 注意：L1是列表缓存，无法单独清除某个技能
    // L3参考文档缓存需要知道具体路径，这里无法清除
    
    this.logger.debug(`已清除技能 ${name} 的 L2 缓存`);
  }

  /**
   * 清除所有技能缓存（L1 + L2 + L3）
   * 
   * 注意：此方法会清除 Redis 中所有技能相关的缓存键
   */
  clearAllCache(): void {
    // 清除L2内存缓存
    this.l2Cache.clear();
    
    // 清除Redis所有技能缓存
    // 注意：reset() 会清除所有缓存，包括非技能相关的
    // 如果需要更精细的控制，应该使用模式删除
    this.cacheService.reset();
    
    this.logger.log('已清除所有技能缓存（L1 + L2 + L3）');
  }

  /**
   * 清除L1元数据列表缓存
   * 用于强制刷新技能列表
   * @param appCode 应用标识，不传则清除所有
   */
  invalidateL1Cache(appCode?: string): void {
    const cacheKey = CacheKeys.l1MetadataList(appCode);
    this.cacheService.del(cacheKey);
    this.logger.debug(`已清除 L1 缓存: ${cacheKey}`);
  }

  /**
   * 添加到L2内存缓存（LRU策略）
   */
  private addToL2Cache(name: string, descriptor: SkillDescriptor): void {
    // LRU策略：超过最大容量时删除最旧的
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

    this.l2Cache.set(name, {
      descriptor,
      timestamp: Date.now(),
    });
  }

  /**
   * 从L2内存缓存获取
   */
  private getFromL2Cache(name: string): SkillDescriptor | null {
    const entry = this.l2Cache.get(name);
    if (!entry) return null;

    // 检查TTL
    if (Date.now() - entry.timestamp > CACHE_CONFIG.L2_TTL) {
      this.l2Cache.delete(name);
      return null;
    }

    return entry.descriptor;
  }
}
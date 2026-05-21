import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { DatabaseSkillProvider } from './standard/database-skill-provider';
import { SkillFrontmatter } from './standard/skill-md-validator';
import { IsolationContext } from '../common/services/base-isolated.service';
import { SkillCacheManager } from './skill-cache-manager';
import { SkillProviderChain } from './skill-provider-chain';

/**
 * 技能元数据（L1 层）
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
  hasAssets?: boolean;
  discoveredAt?: string;
  fileSize?: number;
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
 */
export interface ISkillProvider {
  listAll(context?: IsolationContext): Promise<SkillMetadata[]>;
  resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null>;
  supportsReferences?(): boolean;
  loadReference?(skillName: string, referencePath: string): Promise<string>;
  listReferences?(skillName: string): Promise<string[]>;
}

/**
 * 统一技能注册中心（门面）
 *
 * 组合 SkillCacheManager + SkillProviderChain + SkillScanner，
 * 提供带缓存的技能查询和索引管理。
 */
@Injectable()
export class SkillRegistry implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistry.name);

  constructor(
    private readonly skillScanner: SkillScanner,
    private readonly fileSkillProvider: FileSkillProvider,
    private readonly databaseSkillProvider: DatabaseSkillProvider,
    private readonly cacheManager: SkillCacheManager,
    private readonly providerChain: SkillProviderChain,
  ) {}

  async onModuleInit() {
    this.providerChain.registerProvider(this.databaseSkillProvider);
    this.providerChain.registerProvider(this.fileSkillProvider);
    this.logger.log(`技能注册中心已初始化`);
  }

  // ================================================================
  // 技能查询（带缓存）
  // ================================================================

  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const appCode = context?.appCode ?? undefined;

    const cached = await this.cacheManager.getL1Metadata(appCode);
    if (cached) return cached;

    const results = await this.providerChain.listAll(context);
    await this.cacheManager.setL1Metadata(appCode, results);
    return results;
  }

  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    // 1. L2 内存缓存
    const memCached = this.cacheManager.getL2Descriptor(name);
    if (memCached) return memCached;

    // 2. L2 Redis 缓存
    const redisCached = await this.cacheManager.getL2DescriptorFromRedis(name);
    if (redisCached) return redisCached;

    // 3. 从提供者链获取
    const descriptor = await this.providerChain.resolve(name, context);
    if (descriptor) {
      await this.cacheManager.setL2DescriptorWithRedis(name, descriptor);
    }
    return descriptor;
  }

  async findByName(name: string, context?: IsolationContext): Promise<SkillMetadata | null> {
    return this.providerChain.findByName(name, context);
  }

  async loadReference(skillName: string, referencePath: string): Promise<string> {
    const cached = await this.cacheManager.getL3Reference(skillName, referencePath);
    if (cached) return cached;

    const content = await this.providerChain.loadReference(skillName, referencePath);
    await this.cacheManager.setL3Reference(skillName, referencePath, content);
    return content;
  }

  async listReferences(skillName: string): Promise<string[]> {
    return this.providerChain.listReferences(skillName);
  }

  // ================================================================
  // 扫描器集成
  // ================================================================

  getSkillDirectory(name: string): string | null {
    const entry = this.skillScanner.findByName(name);
    return entry?.directoryPath || null;
  }

  hasScripts(name: string): boolean {
    const entry = this.skillScanner.findByName(name);
    return entry?.hasScripts || false;
  }

  async refresh(): Promise<{ scanned: number; synced: number; errors: number; duration: number }> {
    const startTime = Date.now();
    const scanResult = await this.skillScanner.scan();

    const entries = await this.skillScanner.buildSyncEntries();
    let synced = 0;
    if (entries.length > 0) {
      await this.databaseSkillProvider.syncFromFilesystem(entries);
      synced = entries.length;
    }

    await this.cacheManager.clearAll();

    const duration = Date.now() - startTime;
    this.logger.log(`技能索引已刷新，数据库已同步，缓存已清除，耗时 ${duration}ms`);

    return {
      scanned: this.skillScanner.getIndex().length,
      synced,
      errors: scanResult.errors.length,
      duration,
    };
  }

  async syncToDatabase(): Promise<number> {
    const entries = await this.skillScanner.buildSyncEntries();
    if (entries.length > 0) {
      await this.databaseSkillProvider.syncFromFilesystem(entries);
    }
    return entries.length;
  }

  getStats() {
    const cacheStats = this.cacheManager.getStats();
    return {
      filesystemSkills: this.skillScanner.getIndex().length,
      l2CacheSize: cacheStats.l2CacheSize,
      cacheConfig: cacheStats.cacheConfig,
    };
  }

  // ================================================================
  // 缓存管理
  // ================================================================

  invalidateCache(name: string): void {
    this.cacheManager.invalidate(name);
  }

  async clearAllCache(): Promise<void> {
    await this.cacheManager.clearAll();
  }

  async invalidateL1Cache(appCode?: string): Promise<void> {
    await this.cacheManager.invalidateL1(appCode);
  }
}

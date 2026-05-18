import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { SkillFrontmatter } from './standard/skill-md-validator';
import { IsolationContext } from '../common/services/base-isolated.service';

/**
 * 技能元数据（L1 层，始终驻留）
 */
export interface SkillMetadata {
  name: string;
  description: string;
  source: 'filesystem';
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
 */
export interface ISkillProvider {
  readonly source: 'filesystem';
  listAll(context?: IsolationContext): Promise<SkillMetadata[]>;
  resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null>;
  loadReference?(skillName: string, referencePath: string): Promise<string>;
  listReferences?(skillName: string): Promise<string[]>;
}

/**
 * 统一技能注册中心
 *
 * 所有技能均以 Agent Skills V1.0 标准格式存储在文件系统中。
 * Provider 模式支持扩展，按注册顺序查询。
 */
@Injectable()
export class SkillRegistry implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistry.name);
  private readonly providers: ISkillProvider[] = [];

  constructor(
    private readonly skillScanner: SkillScanner,
    private readonly fileSkillProvider: FileSkillProvider,
  ) {}

  async onModuleInit() {
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
   */
  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
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
        this.logger.warn(`Provider ${provider.source} listAll 失败: ${(err as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 解析完整技能描述（L1 + L2）
   * 按 Provider 注册顺序查找，第一个返回非 null 结果的为准
   */
  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    for (const provider of this.providers) {
      try {
        const descriptor = await provider.resolve(name, context);
        if (descriptor) {
          return descriptor;
        }
      } catch (err) {
        this.logger.warn(`Provider ${provider.source} resolve("${name}") 失败: ${(err as Error).message}`);
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
   */
  async loadReference(skillName: string, referencePath: string): Promise<string> {
    for (const provider of this.providers) {
      if (provider.loadReference) {
        try {
          return await provider.loadReference(skillName, referencePath);
        } catch {
          // 继续尝试下一个 provider
        }
      }
    }
    throw new Error(`技能 ${skillName} 不存在或没有 references 支持`);
  }

  /**
   * 列出 references/ 目录
   */
  async listReferences(skillName: string): Promise<string[]> {
    for (const provider of this.providers) {
      if (provider.listReferences) {
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
   * 获取扫描器中的技能索引条目（含 directoryPath 等文件系统信息）
   */
  getScannerEntry(name: string) {
    return this.skillScanner.findByName(name);
  }

  /**
   * 刷新文件系统技能索引
   */
  async refresh(): Promise<void> {
    await this.skillScanner.scan();
    this.logger.log('技能索引已刷新');
  }
}

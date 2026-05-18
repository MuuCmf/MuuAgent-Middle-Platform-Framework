import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillScanner } from './standard/skill-scanner';
import { FileSkillProvider } from './standard/file-skill-provider';
import { SkillFrontmatter } from './standard/skill-md-validator';
import { IsolationContext } from '../common/utils/isolation.util';

/**
 * 技能元数据（L1 层，始终驻留）
 */
export interface SkillMetadata {
  name: string;
  description: string;
  source: 'database' | 'filesystem';
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
  readonly source: 'database' | 'filesystem';
  listAll(context?: IsolationContext): Promise<SkillMetadata[]>;
  resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null>;
  loadReference?(skillName: string, referencePath: string): Promise<string>;
  listReferences?(skillName: string): Promise<string[]>;
}

/**
 * 统一技能注册中心
 *
 * 合并 DB 技能和文件系统技能，对上层提供一致的查询接口。
 * 同名技能 DB 优先。
 */
@Injectable()
export class SkillRegistry implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistry.name);
  private readonly providers: ISkillProvider[] = [];

  constructor(
    private readonly skillService: SkillService,
    private readonly skillScanner: SkillScanner,
    private readonly fileSkillProvider: FileSkillProvider,
  ) {}

  async onModuleInit() {
    // 注册 Provider（DB 优先）
    this.registerProvider(new DbSkillProvider(this.skillService));
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
   * DB 技能优先，同名文件系统技能被遮蔽
   */
  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const seen = new Set<string>();
    const results: SkillMetadata[] = [];

    // DB Provider 优先（先注册的先遍历）
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
        } catch (err) {
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
   * 刷新文件系统技能索引
   */
  async refresh(): Promise<void> {
    await this.skillScanner.scan();
    this.logger.log('技能索引已刷新');
  }
}

/**
 * DB 技能数据提供者
 * 适配现有 SkillService 到 ISkillProvider 接口
 */
class DbSkillProvider implements ISkillProvider {
  readonly source = 'database' as const;

  constructor(private readonly skillService: SkillService) {}

  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const result = await this.skillService.findAll(
      { pageSize: 9999, status: true },
      context || { appCode: null, isSuperAdmin: false },
    );
    const skills = Array.isArray(result) ? result : (result as any).list || [];

    return skills.map((s: any) => ({
      name: s.code,
      description: s.description || '',
      source: 'database' as const,
      type: s.type,
      appCode: s.appCode,
      isPublic: s.isPublic,
      hasReferences: false,
      hasScripts: s.type === 'FUNCTION' && s.codeType === 'sandbox',
    }));
  }

  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const skill = await this.skillService.findByCode(name, context);
    if (!skill) return null;

    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse((skill as any).params || '{}');
    } catch { /* ignore */ }

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse((skill as any).config || '{}');
    } catch { /* ignore */ }

    const instructions = [
      `# ${(skill as any).name}`,
      '',
      `## 描述`,
      (skill as any).description || '',
      '',
      `## 参数`,
      '```json',
      JSON.stringify(params, null, 2),
      '```',
      '',
      `## 类型`,
      (skill as any).type,
    ].join('\n');

    return {
      metadata: {
        name: (skill as any).code,
        description: (skill as any).description || '',
        source: 'database',
        type: (skill as any).type,
        appCode: (skill as any).appCode,
        isPublic: (skill as any).isPublic,
        hasReferences: false,
        hasScripts: (skill as any).type === 'FUNCTION' && (skill as any).codeType === 'sandbox',
      },
      instructions,
      executionConfig: {
        type: (skill as any).type,
        config,
        params,
      },
    };
  }
}

/**
 * Prisma Skill 类型（让 DbSkillProvider 编译通过）
 */
interface PrismaSkill {
  id: bigint;
  name: string;
  code: string;
  description: string | null;
  type: string;
  params: string;
  config: string;
  status: boolean;
  timeout: number;
  codeType: string | null;
  pluginName: string | null;
  functionName: string | null;
  codeContent: string | null;
  appCode: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

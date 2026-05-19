import { Injectable, Logger } from '@nestjs/common';
import { ISkillProvider, SkillMetadata, SkillDescriptor } from './skill-registry';
import { IsolationContext } from '../common/services/base-isolated.service';

/**
 * 技能提供者链
 *
 * 管理 ISkillProvider 列表，按注册顺序（数据库优先 → 文件系统回源）
 * 进行技能查找。同名技能以先注册的提供者为准。
 */
@Injectable()
export class SkillProviderChain {
  private readonly logger = new Logger(SkillProviderChain.name);
  private readonly providers: ISkillProvider[] = [];

  /** 注册提供者（先注册的优先级更高） */
  registerProvider(provider: ISkillProvider): void {
    this.providers.push(provider);
  }

  /** 列出所有可用技能的元数据（去重：同名技能先注册的优先） */
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
        this.logger.warn(`Provider listAll 失败: ${(err as Error).message}`);
      }
    }

    return results;
  }

  /** 解析完整技能描述符（返回第一个非 null 结果） */
  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    for (const provider of this.providers) {
      try {
        const descriptor = await provider.resolve(name, context);
        if (descriptor) return descriptor;
      } catch (err) {
        this.logger.warn(`Provider resolve("${name}") 失败: ${(err as Error).message}`);
      }
    }
    return null;
  }

  /** 按名称查找单个技能元数据 */
  async findByName(name: string, context?: IsolationContext): Promise<SkillMetadata | null> {
    const all = await this.listAll(context);
    return all.find(s => s.name === name) || null;
  }

  /** 加载参考文档内容 */
  async loadReference(skillName: string, referencePath: string): Promise<string> {
    for (const provider of this.providers) {
      if (provider.supportsReferences?.() && provider.loadReference) {
        try {
          return await provider.loadReference(skillName, referencePath);
        } catch {
          // 继续尝试下一个 provider
        }
      }
    }
    throw new Error(`技能 ${skillName} 不存在或没有 references 支持`);
  }

  /** 列出技能的所有参考文档 */
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
}

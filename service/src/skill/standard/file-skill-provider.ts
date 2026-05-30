import { Injectable, Logger } from '@nestjs/common';
import { SkillScanner, SkillIndexEntry } from './skill-scanner';
import { SkillMdParser } from './skill-md-parser';
import { ISkillProvider, SkillMetadata, SkillDescriptor } from '../skill-registry';
import { IsolationContext } from '../../common/services/base-isolated.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 文件系统技能数据提供者
 * 将文件系统技能索引包装为 ISkillProvider 接口
 */
@Injectable()
export class FileSkillProvider implements ISkillProvider {
  private readonly logger = new Logger(FileSkillProvider.name);

  constructor(
    private readonly scanner: SkillScanner,
    private readonly parser: SkillMdParser,
  ) {}

  /**
   * 列出所有可用技能的元数据
   * @param context 隔离上下文
   * @returns 技能元数据列表
   */
  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const allEntries = this.scanner.getIndex();

    return allEntries
      .filter(entry => this.matchesAppContext(entry, context))
      .map(entry => this.toMetadata(entry));
  }

  /**
   * 解析完整技能描述符
   * @param name 技能名称
   * @param context 隔离上下文
   * @returns 技能描述符
   */
  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const entry = this.scanner.findByName(name);

    if (!entry) return null;
    if (!this.matchesAppContext(entry, context)) return null;

    try {
      const parsed = await this.parser.parseFromFile(entry.skillMdPath);

      return {
        metadata: this.toMetadata(entry),
        instructions: parsed.body,
        frontmatter: parsed.frontmatter,
        allowedTools: parsed.frontmatter.allowedTools
          ? parsed.frontmatter.allowedTools.split(/\s+/).filter(Boolean)
          : undefined,
      };
    } catch (err) {
      this.logger.error(`解析技能 ${name} 失败: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 支持 references 功能
   * @returns true
   */
  supportsReferences(): boolean {
    return true;
  }

  /**
   * 加载参考文档内容
   * @param skillName 技能名称
   * @param referencePath 参考文档路径
   * @returns 文档内容
   */
  async loadReference(skillName: string, referencePath: string): Promise<string> {
    const entry = this.scanner.findByName(skillName);
    if (!entry) {
      throw new Error(`技能 ${skillName} 不存在`);
    }

    const fullPath = path.join(entry.directoryPath, 'references', referencePath);

    // 防目录穿越
    const normalizedRef = path.resolve(entry.directoryPath, 'references');
    const normalizedPath = path.resolve(fullPath);
    if (!normalizedPath.startsWith(normalizedRef)) {
      throw new Error(`不允许访问 references 目录外的文件: ${referencePath}`);
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (err) {
      throw new Error(`读取参考文档失败: ${(err as Error).message}`);
    }
  }

  /**
   * 列出技能的所有参考文档
   * @param skillName 技能名称
   * @returns 参考文档路径列表
   */
  async listReferences(skillName: string): Promise<string[]> {
    const entry = this.scanner.findByName(skillName);
    if (!entry || !entry.hasReferences) return [];

    const refDir = path.join(entry.directoryPath, 'references');

    try {
      const files = await fs.readdir(refDir);
      return files;
    } catch {
      return [];
    }
  }

  private toMetadata(entry: SkillIndexEntry): SkillMetadata {
    return {
      name: entry.name,
      description: entry.description,
      source: 'filesystem',
      type: undefined,
      appCode: entry.appCode,
      isPublic: entry.isPublic,
      hasReferences: entry.hasReferences,
      hasScripts: entry.hasScripts,
    };
  }

  private matchesAppContext(entry: SkillIndexEntry, context?: IsolationContext): boolean {
    if (!context || context.skipIsolation) return true;
    if (entry.isPublic) return true;
    if (!context.appCode) return entry.isPublic;
    return entry.appCode === context.appCode;
  }
}

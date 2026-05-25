import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ISkillProvider, SkillMetadata, SkillDescriptor } from '../skill-registry';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { SkillFrontmatter } from './skill-md-validator';

/**
 * 数据库技能数据提供者
 * 将数据库中的技能数据包装为 ISkillProvider 接口
 * 
 * 作为分层缓存架构的主要数据源，提供以下能力：
 * - 从数据库读取技能元数据（L1层）
 * - 从数据库读取完整技能描述符（L2层）
 * - 从数据库读取参考文档缓存（L3层）
 */
@Injectable()
export class DatabaseSkillProvider implements ISkillProvider {
  private readonly logger = new Logger(DatabaseSkillProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 列出所有可用技能的元数据
   * @param context 隔离上下文
   * @returns 技能元数据列表
   */
  async listAll(context?: IsolationContext): Promise<SkillMetadata[]> {
    const where = this.buildWhereClause(context);
    
    const skills = await this.prisma.skill.findMany({
      where,
      select: {
        name: true,
        description: true,
        source: true,
        type: true,
        appCode: true,
        uid: true,
        isPublic: true,
        hasReferences: true,
        hasScripts: true,
      },
    });

    return skills.map(skill => ({
      name: skill.name,
      description: skill.description,
      source: skill.source as 'database' | 'filesystem',
      type: skill.type || undefined,
      appCode: skill.appCode || null,
      uid: skill.uid || undefined,
      isPublic: skill.isPublic,
      hasReferences: skill.hasReferences,
      hasScripts: skill.hasScripts,
    }));
  }

  /**
   * 解析完整技能描述符
   * @param name 技能名称
   * @param context 隔离上下文
   * @returns 技能描述符
   */
  async resolve(name: string, context?: IsolationContext): Promise<SkillDescriptor | null> {
    const skill = await this.prisma.skill.findUnique({
      where: { name },
    });

    if (!skill) return null;
    
    if (!this.matchesAppContext(skill, context)) return null;

    return {
      metadata: {
        name: skill.name,
        description: skill.description,
        source: skill.source as 'database' | 'filesystem',
        type: skill.type || undefined,
        appCode: skill.appCode || null,
        uid: skill.uid || undefined,
        isPublic: skill.isPublic,
        hasReferences: skill.hasReferences,
        hasScripts: skill.hasScripts,
      },
      instructions: skill.instructions || '',
      frontmatter: skill.frontmatter as unknown as SkillFrontmatter,
      allowedTools: this.parseAllowedTools(skill.allowedTools),
    };
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
    const skill = await this.prisma.skill.findUnique({
      where: { name: skillName },
      select: { id: true },
    });

    if (!skill) {
      throw new Error(`技能 ${skillName} 不存在`);
    }

    const reference = await this.prisma.skillReference.findUnique({
      where: {
        skillId_filePath: {
          skillId: skill.id,
          filePath: referencePath,
        },
      },
    });

    if (!reference) {
      throw new Error(`参考文档 ${referencePath} 不存在`);
    }

    return reference.content;
  }

  /**
   * 列出技能的所有参考文档
   * @param skillName 技能名称
   * @returns 参考文档路径列表
   */
  async listReferences(skillName: string): Promise<string[]> {
    const skill = await this.prisma.skill.findUnique({
      where: { name: skillName },
      select: { id: true, hasReferences: true },
    });

    if (!skill || !skill.hasReferences) return [];

    const references = await this.prisma.skillReference.findMany({
      where: { skillId: skill.id },
      select: { filePath: true },
    });

    return references.map(r => r.filePath);
  }

  /**
   * 将文件系统技能同步到数据库
   * @param entries 技能条目数组
   */
  async syncFromFilesystem(entries: Array<{
    name: string;
    description: string;
    directoryPath: string;
    skillMdPath: string;
    frontmatter: SkillFrontmatter;
    hasScripts: boolean;
    hasReferences: boolean;
    hasAssets: boolean;
    appCode: string | null;
    uid: string | null;
    isPublic: boolean;
    instructions: string;
    allowedTools?: string[];
    references?: Array<{ filePath: string; content: string }>;
  }>): Promise<void> {
    for (const entry of entries) {
      // 使用事务确保完整性
      await this.prisma.$transaction(async (tx) => {
        // 创建或更新技能
        const skill = await tx.skill.upsert({
          where: { name: entry.name },
          update: {
            description: entry.description,
            source: 'filesystem',
            appCode: entry.appCode,
            uid: entry.uid,
            isPublic: entry.isPublic,
            hasReferences: entry.hasReferences,
            hasScripts: entry.hasScripts,
            hasAssets: entry.hasAssets,
            directoryPath: entry.directoryPath,
            instructions: entry.instructions,
            frontmatter: entry.frontmatter as any,
            allowedTools: entry.allowedTools || [],
          },
          create: {
            name: entry.name,
            description: entry.description,
            source: 'filesystem',
            appCode: entry.appCode,
            uid: entry.uid,
            isPublic: entry.isPublic,
            hasReferences: entry.hasReferences,
            hasScripts: entry.hasScripts,
            hasAssets: entry.hasAssets,
            directoryPath: entry.directoryPath,
            instructions: entry.instructions,
            frontmatter: entry.frontmatter as any,
            allowedTools: entry.allowedTools || [],
          },
        });

        // 同步参考文档
        if (entry.references && entry.references.length > 0) {
          for (const ref of entry.references) {
            await tx.skillReference.upsert({
              where: {
                skillId_filePath: {
                  skillId: skill.id,
                  filePath: ref.filePath,
                },
              },
              update: {
                content: ref.content,
              },
              create: {
                skillId: skill.id,
                filePath: ref.filePath,
                content: ref.content,
              },
            });
          }
        }
      });
    }

    this.logger.log(`已同步 ${entries.length} 个技能到数据库`);
  }

  /**
   * 删除数据库中的技能记录
   */
  async deleteSkill(name: string): Promise<void> {
    await this.prisma.skill.delete({
      where: { name },
    });
    this.logger.log(`已删除数据库中的技能: ${name}`);
  }

  /**
   * 清空所有数据库技能记录
   */
  async clearAll(): Promise<void> {
    await this.prisma.skillReference.deleteMany({});
    await this.prisma.skill.deleteMany({});
    this.logger.log('已清空数据库中的所有技能记录');
  }

  /**
   * 构建查询条件（支持用户级隔离）
   */
  private buildWhereClause(context?: IsolationContext) {
    if (!context || context.isSuperAdmin) {
      return {};
    }
    
    if (!context.appCode) {
      return { isPublic: true };
    }

    // 用户级隔离：可见范围 = 自己的私有技能 + 应用级公共技能(uid为空) + 公开技能
    if (context.uid) {
      return {
        OR: [
          { isPublic: true },
          { appCode: context.appCode, uid: context.uid },
          { appCode: context.appCode, uid: null },
        ],
      };
    }

    // 应用级隔离：可见范围 = 应用技能 + 公开技能
    return {
      OR: [
        { isPublic: true },
        { appCode: context.appCode },
      ],
    };
  }

  /**
   * 检查技能是否匹配应用上下文（支持用户级隔离）
   */
  private matchesAppContext(
    skill: { appCode: string | null; uid: string | null; isPublic: boolean },
    context?: IsolationContext,
  ): boolean {
    if (!context || context.isSuperAdmin) return true;
    if (skill.isPublic) return true;
    
    if (!context.appCode) return skill.isPublic;
    if (skill.appCode !== context.appCode) return false;
    
    // 用户级隔离检查
    if (context.uid) {
      // 自己的私有技能或应用级公共技能
      return skill.uid === context.uid || skill.uid === null;
    }
    
    return true;
  }

  /**
   * 解析allowedTools字段（JSON数组转字符串数组）
   */
  private parseAllowedTools(allowedTools: unknown): string[] | undefined {
    if (!allowedTools) return undefined;
    
    if (Array.isArray(allowedTools)) {
      return allowedTools.length > 0 ? allowedTools as string[] : undefined;
    }
    
    try {
      const parsed = typeof allowedTools === 'string' 
        ? JSON.parse(allowedTools) 
        : allowedTools;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as string[];
      }
    } catch {
      // 忽略解析错误
    }
    
    return undefined;
  }
}
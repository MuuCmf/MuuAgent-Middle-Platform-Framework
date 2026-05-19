import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { SkillRegistry } from './skill-registry';
import { IsolationContext } from '../common/services/base-isolated.service';
import { AgentSkills } from '../agent/types/agent-skills';

/**
 * 知识库检索结果
 */
export interface KbRetrievalResult {
  kbCode: string;
  kbName: string;
  chunks: Array<{
    content: string;
    score: number;
    docName: string;
  }>;
}

/**
 * 增强提示词结果
 */
export interface AugmentedPrompt {
  systemPrompt: string;
  context: string;
  sources: Array<{
    kbCode: string;
    kbName: string;
    docName: string;
  }>;
}

/**
 * 技能知识库服务
 * 从技能声明的依赖中解析知识库并提供检索功能
 */
@Injectable()
export class SkillKbService {
  private readonly logger = new Logger(SkillKbService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param retrievalService 检索服务
   * @param aiService AI服务
   * @param skillRegistry 技能注册中心
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    private readonly skillRegistry: SkillRegistry,
  ) {}

  /**
   * 从技能名称列表中解析知识库 codes（唯一入口）
   * 替代 ContextBuilder 和 ToolExecutor 中的重复解析逻辑
   * @param agentSkills 类型化的技能列表
   * @param isolationContext 隔离上下文
   * @returns 知识库 code 列表
   */
  async resolveKbCodes(agentSkills: AgentSkills, isolationContext?: IsolationContext): Promise<string[]> {
    const skillNames = agentSkills.toArray();
    if (skillNames.length === 0) return [];

    const kbCodes = new Set<string>();

    for (const skillName of skillNames) {
      const skill = await this.skillRegistry.resolve(skillName, isolationContext || { appCode: null, isSuperAdmin: false });
      if (skill?.frontmatter?.requires?.knowledgeBases) {
        for (const kbCode of skill.frontmatter.requires.knowledgeBases) {
          kbCodes.add(kbCode);
        }
      }
    }

    return Array.from(kbCodes);
  }

  /**
   * 从智能体的技能配置中获取知识库列表
   * @param agentId 智能体ID
   * @param isolationContext 隔离上下文
   * @returns 知识库code列表
   */
  async getAgentKbCodes(agentId: string, isolationContext?: IsolationContext): Promise<string[]> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId as any },
      select: { skills: true, appCode: true },
    });

    if (!agent || !agent.skills) {
      return [];
    }

    const agentSkills = AgentSkills.fromJson(agent.skills);
    if (agentSkills.isEmpty()) {
      return [];
    }

    const context: IsolationContext = isolationContext || { appCode: agent.appCode || null, isSuperAdmin: false };
    return this.resolveKbCodes(agentSkills, context);
  }

  /**
   * 检索技能依赖的知识库
   * @param agentId 智能体ID
   * @param query 查询问题
   * @param topK 每个知识库返回的条数
   * @param similarityThreshold 相似度阈值
   * @param isolationContext 隔离上下文
   * @returns {Promise<KbRetrievalResult[]>} 检索结果
   */
  async retrieveFromAgentKbs(
    agentId: string,
    query: string,
    topK: number = 5,
    similarityThreshold: number = 0.7,
    isolationContext?: IsolationContext,
  ): Promise<KbRetrievalResult[]> {
    const startTime = Date.now();

    const kbCodes = await this.getAgentKbCodes(agentId, isolationContext);

    if (kbCodes.length === 0) {
      this.logger.warn(`智能体 ${agentId} 绑定的技能未声明知识库依赖`);
      return [];
    }

    this.logger.log(`智能体 ${agentId} 通过技能绑定了 ${kbCodes.length} 个知识库: ${kbCodes.join(', ')}`);

    const kbs = await this.prisma.kbInfo.findMany({
      where: {
        kbCode: { in: kbCodes },
        status: true,
        isDeleted: false,
      },
      select: {
        id: true,
        kbCode: true,
        kbName: true,
        similarityThresh: true,
        topN: true,
      },
    });

    if (kbs.length === 0) {
      this.logger.warn(`未找到有效的知识库`);
      return [];
    }

    const results: KbRetrievalResult[] = [];

    for (const kb of kbs) {
      try {
        const retrievalResult = await this.retrievalService.retrieval({
          kbId: kb.id as any,
          query,
          topN: topK || kb.topN,
          similarityThresh: similarityThreshold || kb.similarityThresh,
        });

        if (retrievalResult && retrievalResult.items && retrievalResult.items.length > 0) {
          results.push({
            kbCode: kb.kbCode,
            kbName: kb.kbName,
            chunks: retrievalResult.items.map((item: any) => ({
              content: item.content,
              score: item.score,
              docName: item.docName,
            })),
          });
        }
      } catch (error) {
        this.logger.error(`从知识库 ${kb.kbCode} 检索失败:`, error);
      }
    }

    const costTime = Date.now() - startTime;
    this.logger.log(`知识库检索完成，耗时 ${costTime}ms，检索到 ${results.length} 个知识库的内容`);

    return results;
  }

  /**
   * 构建增强提示词
   * @param systemPrompt 原始系统提示词
   * @param retrievalResults 检索结果
   * @returns {AugmentedPrompt} 增强后的提示词
   */
  buildAugmentedPrompt(
    systemPrompt: string,
    retrievalResults: KbRetrievalResult[],
  ): AugmentedPrompt {
    if (retrievalResults.length === 0) {
      return {
        systemPrompt,
        context: '',
        sources: [],
      };
    }

    const contextParts: string[] = [];
    const sources: Array<{ kbCode: string; kbName: string; docName: string }> = [];

    for (const result of retrievalResults) {
      for (const chunk of result.chunks) {
        contextParts.push(`【${result.kbName}】${chunk.content}`);

        const sourceKey = `${result.kbCode}-${chunk.docName}`;
        if (!sources.find(s => `${s.kbCode}-${s.docName}` === sourceKey)) {
          sources.push({
            kbCode: result.kbCode,
            kbName: result.kbName,
            docName: chunk.docName,
          });
        }
      }
    }

    const context = contextParts.join('\n\n');

    const augmentedSystemPrompt = `${systemPrompt}

## 知识库上下文

以下是来自知识库的相关信息，请基于这些信息回答用户问题：

${context}

## 回答要求

1. 优先使用知识库中的信息回答
2. 如果知识库中没有相关信息，请明确告知用户
3. 回答时要标注信息来源
4. 保持回答的准确性和专业性`;

    return {
      systemPrompt: augmentedSystemPrompt,
      context,
      sources,
    };
  }

  /**
   * 智能体对话（带知识库检索增强）
   * @param agentId 智能体ID
   * @param query 用户问题
   * @param systemPrompt 系统提示词
   * @param topK 检索条数
   * @param similarityThreshold 相似度阈值
   * @param isolationContext 隔离上下文
   * @returns {Promise<AugmentedPrompt>} 增强后的提示词
   */
  async augmentPromptWithKb(
    agentId: string,
    query: string,
    systemPrompt: string,
    topK?: number,
    similarityThreshold?: number,
    isolationContext?: IsolationContext,
  ): Promise<AugmentedPrompt> {
    const retrievalResults = await this.retrieveFromAgentKbs(
      agentId,
      query,
      topK,
      similarityThreshold,
      isolationContext,
    );

    return this.buildAugmentedPrompt(systemPrompt, retrievalResults);
  }
}

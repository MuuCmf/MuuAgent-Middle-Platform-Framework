import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { AiService } from '../ai/ai.service';

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
 * 智能体知识库服务
 */
@Injectable()
export class AgentKbService {
  private readonly logger = new Logger(AgentKbService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param retrievalService 检索服务
   * @param aiService AI服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 检索智能体绑定的知识库
   * @param agentId 智能体ID
   * @param query 查询问题
   * @param topK 每个知识库返回的条数
   * @param similarityThreshold 相似度阈值
   * @returns {Promise<KbRetrievalResult[]>} 检索结果
   */
  async retrieveFromAgentKbs(
    agentId: string,
    query: string,
    topK: number = 5,
    similarityThreshold: number = 0.7,
  ): Promise<KbRetrievalResult[]> {
    const startTime = Date.now();

    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { knowledgeBases: true },
    });

    if (!agent || !agent.knowledgeBases) {
      this.logger.warn(`智能体 ${agentId} 未绑定知识库`);
      return [];
    }

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases);
    if (kbCodes.length === 0) {
      this.logger.warn(`智能体 ${agentId} 绑定的知识库列表为空`);
      return [];
    }

    this.logger.log(`智能体 ${agentId} 绑定了 ${kbCodes.length} 个知识库: ${kbCodes.join(', ')}`);

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
          kbId: kb.id,
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
   * @returns {Promise<AugmentedPrompt>} 增强后的提示词
   */
  async augmentPromptWithKb(
    agentId: string,
    query: string,
    systemPrompt: string,
    topK?: number,
    similarityThreshold?: number,
  ): Promise<AugmentedPrompt> {
    const retrievalResults = await this.retrieveFromAgentKbs(
      agentId,
      query,
      topK,
      similarityThreshold,
    );

    return this.buildAugmentedPrompt(systemPrompt, retrievalResults);
  }
}

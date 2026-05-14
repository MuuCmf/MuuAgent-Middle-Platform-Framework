import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { ToolDefinition } from '../react/react.types';

/**
 * 知识库检索工具配置
 */
export interface KbSearchToolConfig {
  enabled: boolean;
  defaultTopK: number;
  defaultSimilarityThreshold: number;
  allowSpecifyKb: boolean;
}

/**
 * 知识库检索工具
 * 复用现有的 RetrievalService
 */
@Injectable()
export class KbSearchTool {
  private readonly logger = new Logger(KbSearchTool.name);

  private defaultConfig: KbSearchToolConfig = {
    enabled: true,
    defaultTopK: 5,
    defaultSimilarityThreshold: 0.7,
    allowSpecifyKb: true,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
  ) {}

  /**
   * 获取工具定义
   */
  async getToolDefinition(
    agentId: string,
    kbCodes: string[],
  ): Promise<ToolDefinition | null> {
    if (!kbCodes || kbCodes.length === 0) {
      return null;
    }

    // 获取知识库信息用于描述
    const kbNames = await this.getKbNames(kbCodes);

    return {
      name: 'kb_search',
      description: `从知识库中检索相关信息。绑定的知识库: ${kbNames.join(', ')}。当需要查询产品信息、文档内容、FAQ等知识库内容时使用此工具。`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '检索查询语句，应该是一个清晰的问题或关键词',
          },
          kb_codes: {
            type: 'array',
            items: { type: 'string' },
            description: `可选，指定要检索的知识库代码列表。可用知识库: ${kbCodes.join(', ')}。不指定则检索所有绑定的知识库`,
          },
          top_k: {
            type: 'number',
            description: `可选，返回的结果数量，默认${this.defaultConfig.defaultTopK}`,
          },
          similarity_threshold: {
            type: 'number',
            description: `可选，相似度阈值(0-1)，默认${this.defaultConfig.defaultSimilarityThreshold}`,
          },

        },
        required: ['query'],
      },
      type: 'kb',
    };
  }

  /**
   * 执行知识库检索
   */
  async execute(
    agentId: string,
    kbCodes: string[],
    params: {
      query: string;
      kb_codes?: string[];
      top_k?: number;
      similarity_threshold?: number;
    },
  ): Promise<any> {
    const startTime = Date.now();

    // 确定要检索的知识库
    const targetKbCodes = params.kb_codes && params.kb_codes.length > 0
      ? params.kb_codes.filter(code => kbCodes.includes(code))
      : kbCodes;

    if (targetKbCodes.length === 0) {
      return {
        success: false,
        message: '没有可用的知识库',
        results: [],
      };
    }

    const topK = params.top_k || this.defaultConfig.defaultTopK;
    const similarityThresh = params.similarity_threshold || this.defaultConfig.defaultSimilarityThreshold;

    this.logger.log(`执行知识库检索: query="${params.query}", kb_codes=${targetKbCodes.join(',')}`);

    try {
      // 获取知识库ID列表
      const kbInfos = await this.prisma.kbInfo.findMany({
        where: { kbCode: { in: targetKbCodes }, status: true, isDeleted: false },
        select: { id: true, kbCode: true, kbName: true, retrievalMethod: true },
      });

      const results: any[] = [];

      // 遍历每个知识库执行检索
      for (const kb of kbInfos) {
        try {
          const retrievalResult = await this.retrievalService.retrieval({
            kbId: kb.id as any,
            query: params.query,
            topN: topK,
            similarityThresh,
          });

          if (retrievalResult && retrievalResult.list && retrievalResult.list.length > 0) {
            results.push({
              kb_code: kb.kbCode,
              kb_name: kb.kbName,
              method: retrievalResult.method || 'vector',
              cache_hit: retrievalResult.cacheHit || false,
              chunks: retrievalResult.list.map((item: any) => ({
                content: item.content,
                score: item.score,
                doc_name: item.docName,
                chunk_id: item.chunkId,
              })),
            });
          }
        } catch (error) {
          this.logger.error(`知识库 ${kb.kbCode} 检索失败: ${error.message}`);
        }
      }

      const costMs = Date.now() - startTime;

      return {
        success: true,
        message: `从 ${results.length} 个知识库检索到相关信息`,
        cost_ms: costMs,
        total_chunks: results.reduce((sum, r) => sum + r.chunks.length, 0),
        results,
      };
    } catch (error) {
      this.logger.error(`知识库检索失败: ${error.message}`);
      return {
        success: false,
        message: `检索失败: ${error.message}`,
        results: [],
      };
    }
  }

  /**
   * 获取知识库名称列表
   */
  private async getKbNames(kbCodes: string[]): Promise<string[]> {
    const kbInfos = await this.prisma.kbInfo.findMany({
      where: { kbCode: { in: kbCodes }, status: true, isDeleted: false },
      select: { kbName: true },
    });
    return kbInfos.map(kb => kb.kbName);
  }
}

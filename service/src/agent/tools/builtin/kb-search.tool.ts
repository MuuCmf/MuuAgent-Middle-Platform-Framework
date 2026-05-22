import { PrismaService } from '../../../common/prisma/prisma.service';
import { RetrievalService } from '../../../retrieval/retrieval.service';
import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { SkillKbService } from '../../../skill/skill-kb.service';
import { IsolationContext } from '../../../common/services/base-isolated.service';

/**
 * 知识库检索工具配置
 */
interface KbSearchToolConfig {
  defaultTopN: number;
  defaultSimilarityThresh: number;
  allowSpecifyKb: boolean;
}

/**
 * 知识库检索工具
 * 从知识库中检索相关信息
 */
@AgentTool({
  name: 'kb_search',
  enabled: true,
  category: 'builtin',
})
export class KbSearchTool extends BaseTool {
  readonly name = 'kb_search';

  private readonly defaultConfig: KbSearchToolConfig = {
    defaultTopN: 5,
    defaultSimilarityThresh: 0.7,
    allowSpecifyKb: true,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    private readonly skillKbService: SkillKbService,
  ) {
    super();
  }

  readonly definition: ToolDefinition = {
    name: 'kb_search',
    description: `从知识库中检索相关信息。当需要查询产品信息、文档内容、FAQ等知识库内容时使用此工具。
使用前请确保已通过 use_skill 加载相关技能指令，了解知识库的使用方式和内容范围。`,
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
          description: '可选，指定要检索的知识库代码列表。不指定则检索所有绑定的知识库',
        },
        top_k: {
          type: 'number',
          description: `可选，返回的结果数量，默认 ${this.defaultConfig.defaultTopN}`,
        },
        similarity_threshold: {
          type: 'number',
          description: `可选，相似度阈值(0-1)，默认 ${this.defaultConfig.defaultSimilarityThresh}`,
        },
      },
      required: ['query'],
    },
    type: 'kb',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
    const startTime = Date.now();
    const query = this.getArg<string>(args, 'query');
    const kbCodes = this.getArg<string[]>(args, 'kb_codes');
    const topN = this.getArg<number>(args, 'top_k', this.defaultConfig.defaultTopN);
    const similarityThresh = this.getArg<number>(
      args,
      'similarity_threshold',
      this.defaultConfig.defaultSimilarityThresh,
    );

    const isolationCtx = this.getIsolationContext(context);
    const availableKbCodes = await this.skillKbService.getAgentKbCodes(String(context.agent.id), isolationCtx);

    const targetKbCodes =
      kbCodes && kbCodes.length > 0
        ? kbCodes.filter((code) => availableKbCodes.includes(code))
        : availableKbCodes;

    if (targetKbCodes.length === 0) {
      return {
        success: false,
        message: '没有可用的知识库',
        results: [],
      };
    }

    this.logger.log(
      `执行知识库检索: query="${query}", kb_codes=${targetKbCodes.join(',')}`,
    );

    try {
      const kbInfos = await this.prisma.kbInfo.findMany({
        where: { kbCode: { in: targetKbCodes }, status: true, isDeleted: false },
        select: { id: true, kbCode: true, kbName: true, retrievalMethod: true },
      });

      const results: any[] = [];

      for (const kb of kbInfos) {
        try {
          const retrievalResult = await this.retrievalService.retrieval({
            kbId: kb.id as any,
            query,
            topN,
            similarityThresh,
          }, isolationCtx);

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
          this.logger.error(`知识库 ${kb.kbCode} 检索失败: ${(error as Error).message}`);
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
      this.logger.error(`知识库检索失败: ${(error as Error).message}`);
      return {
        success: false,
        message: `检索失败: ${(error as Error).message}`,
        results: [],
      };
    }
  }

  /**
   * 获取隔离上下文
   * @param context 工具执行上下文
   */
  private getIsolationContext(context: ToolExecutionContext): IsolationContext {
    if (context.isolationContext) {
      return context.isolationContext;
    }
    return {
      appCode: context.agent.appCode || null,
      isSuperAdmin: false,
    };
  }
}

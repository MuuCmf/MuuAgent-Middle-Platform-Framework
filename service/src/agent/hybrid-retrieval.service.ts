import { Injectable, Logger } from '@nestjs/common';
import { SkillKbService, KbRetrievalResult } from '../skill/skill-kb.service';
import { IsolationContext } from '../common/services/base-isolated.service';
import { AgentSkills } from './types/agent-skills';
import {
  KbRetrievalStrategy,
  KbRetrievalConfig,
  RetrievalResult,
  DEFAULT_KB_RETRIEVAL_CONFIG,
} from './types/kb-retrieval.types';

/**
 * 混合检索策略服务
 * 根据配置决定知识库检索方式：自动检索、工具调用或混合模式
 */
@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);

  /**
   * 构造函数
   * @param skillKbService 技能知识库服务
   */
  constructor(private readonly skillKbService: SkillKbService) {}

  /**
   * 解析Agent的知识库检索配置
   * @param agent Agent对象
   * @returns {KbRetrievalConfig} 检索配置
   */
  parseConfig(agent: { kbRetrievalConfig?: string | null }): KbRetrievalConfig {
    if (!agent.kbRetrievalConfig) {
      return DEFAULT_KB_RETRIEVAL_CONFIG;
    }

    try {
      const config = JSON.parse(agent.kbRetrievalConfig);
      return {
        ...DEFAULT_KB_RETRIEVAL_CONFIG,
        ...config,
        autoRetrieval: {
          ...DEFAULT_KB_RETRIEVAL_CONFIG.autoRetrieval,
          ...config.autoRetrieval,
        },
        toolRetrieval: {
          ...DEFAULT_KB_RETRIEVAL_CONFIG.toolRetrieval,
          ...config.toolRetrieval,
        },
      };
    } catch (e) {
      this.logger.warn(`解析知识库检索配置失败: ${e}`);
      return DEFAULT_KB_RETRIEVAL_CONFIG;
    }
  }

  /**
   * 判断是否需要自动检索
   * @param config 检索配置
   * @param userMessage 用户消息
   * @param conversationHistory 对话历史
   * @returns {boolean} 是否需要自动检索
   */
  shouldAutoRetrieve(
    config: KbRetrievalConfig,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: unknown }>,
  ): boolean {
    const { strategy, autoRetrieval } = config;

    if (strategy === KbRetrievalStrategy.DISABLED || strategy === KbRetrievalStrategy.TOOL) {
      return false;
    }

    if (!autoRetrieval?.enabled) {
      return false;
    }

    switch (autoRetrieval.trigger) {
      case 'always':
        return true;

      case 'first_message':
        return conversationHistory.length === 0;

      case 'keyword':
        if (!autoRetrieval.keywords || autoRetrieval.keywords.length === 0) {
          return true;
        }
        return autoRetrieval.keywords.some(keyword =>
          userMessage.toLowerCase().includes(keyword.toLowerCase()),
        );

      default:
        return true;
    }
  }

  /**
   * 判断是否启用工具检索
   * @param config 检索配置
   * @returns {boolean} 是否启用工具检索
   */
  shouldEnableToolRetrieval(config: KbRetrievalConfig): boolean {
    const { strategy, toolRetrieval } = config;

    if (strategy === KbRetrievalStrategy.DISABLED || strategy === KbRetrievalStrategy.AUTO) {
      return false;
    }

    return toolRetrieval?.enabled ?? false;
  }

  /**
   * 执行自动检索
   * @param agentId Agent ID
   * @param userMessage 用户消息
   * @param systemPrompt 原始系统提示词
   * @param agentSkills Agent技能列表
   * @param config 检索配置
   * @param isolationContext 隔离上下文
   * @returns {Promise<RetrievalResult>} 检索结果
   */
  async executeAutoRetrieval(
    agentId: string,
    userMessage: string,
    systemPrompt: string,
    agentSkills: AgentSkills,
    config: KbRetrievalConfig,
    isolationContext?: IsolationContext,
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const { autoRetrieval } = config;

    this.logger.log(`[AutoRetrieval] 开始自动检索, agentId=${agentId}`);

    try {
      const kbCodes = await this.skillKbService.resolveKbCodes(agentSkills, isolationContext);

      if (kbCodes.length === 0) {
        this.logger.log(`[AutoRetrieval] Agent未绑定知识库, 跳过检索`);
        return {
          success: false,
          strategy: config.strategy,
          chunks: [],
          costMs: Date.now() - startTime,
        };
      }

      const retrievalResults = await this.skillKbService.retrieveFromAgentKbs(
        agentId,
        userMessage,
        autoRetrieval?.topN,
        autoRetrieval?.similarityThresh,
        isolationContext,
      );

      if (retrievalResults.length === 0) {
        this.logger.log(`[AutoRetrieval] 未检索到相关内容`);
        return {
          success: false,
          strategy: config.strategy,
          chunks: [],
          costMs: Date.now() - startTime,
        };
      }

      const chunks = this.flattenRetrievalResults(retrievalResults);

      const augmentedPrompt = this.skillKbService.buildAugmentedPrompt(
        systemPrompt,
        retrievalResults,
      );

      const costMs = Date.now() - startTime;
      this.logger.log(`[AutoRetrieval] 检索完成, 检索到${chunks.length}条内容, 耗时${costMs}ms`);

      return {
        success: true,
        strategy: config.strategy,
        chunks,
        augmentedSystemPrompt: autoRetrieval?.showSources
          ? augmentedPrompt.systemPrompt
          : systemPrompt,
        costMs,
      };
    } catch (error) {
      const costMs = Date.now() - startTime;
      this.logger.error(`[AutoRetrieval] 检索失败: ${error.message}`);
      return {
        success: false,
        strategy: config.strategy,
        chunks: [],
        costMs,
      };
    }
  }

  /**
   * 获取工具检索配置
   * @param config 检索配置
   * @returns {object} 工具配置
   */
  getToolRetrievalConfig(config: KbRetrievalConfig): {
    defaultTopN: number;
    defaultSimilarityThresh: number;
    allowSpecifyKb: boolean;
  } {
    const { toolRetrieval } = config;
    return {
      defaultTopN: toolRetrieval?.defaultTopN || 5,
      defaultSimilarityThresh: toolRetrieval?.defaultSimilarityThresh || 0.7,
      allowSpecifyKb: toolRetrieval?.allowSpecifyKb ?? true,
    };
  }

  /**
   * 扁平化检索结果
   * @param results 检索结果列表
   * @returns {Array} 扁平化的内容列表
   */
  private flattenRetrievalResults(results: KbRetrievalResult[]): RetrievalResult['chunks'] {
    const chunks: RetrievalResult['chunks'] = [];

    for (const result of results) {
      for (const chunk of result.chunks) {
        chunks.push({
          kbCode: result.kbCode,
          kbName: result.kbName,
          content: chunk.content,
          score: chunk.score,
          docName: chunk.docName,
        });
      }
    }

    return chunks;
  }
}

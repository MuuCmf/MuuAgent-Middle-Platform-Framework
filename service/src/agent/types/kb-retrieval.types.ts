/**
 * 知识库检索策略枚举
 */
export enum KbRetrievalStrategy {
  /**
   * 自动检索模式
   * - 在LLM推理前自动检索知识库
   * - 将检索结果注入到系统提示词中
   * - 适用于FAQ问答、知识查询等场景
   */
  AUTO = 'AUTO',

  /**
   * 工具调用模式
   * - LLM自主决定是否调用kb_search工具
   * - 适用于复杂推理、多步骤任务
   */
  TOOL = 'TOOL',

  /**
   * 混合模式（推荐）
   * - 自动检索 + 工具调用并存
   * - 自动检索提供基础上下文
   * - LLM可根据需要二次检索
   */
  HYBRID = 'HYBRID',

  /**
   * 禁用检索
   * - 不进行任何知识库检索
   */
  DISABLED = 'DISABLED',
}

/**
 * 知识库检索配置
 */
export interface KbRetrievalConfig {
  /**
   * 检索策略
   */
  strategy: KbRetrievalStrategy;

  /**
   * 自动检索配置（strategy为AUTO或HYBRID时生效）
   */
  autoRetrieval?: {
    /**
     * 是否启用自动检索
     */
    enabled: boolean;

    /**
     * 检索条数（可选，留空则使用知识库默认配置）
     */
    topN?: number;

    /**
     * 相似度阈值（可选，留空则使用知识库默认配置）
     */
    similarityThresh?: number;

    /**
     * 是否在系统提示词中显示检索来源
     */
    showSources: boolean;

    /**
     * 检索触发条件（可选）
     * - always: 每次对话都检索
     * - first_message: 仅首次消息检索
     * - keyword: 包含关键词时检索
     */
    trigger: 'always' | 'first_message' | 'keyword';

    /**
     * 触发关键词列表（trigger为keyword时生效）
     */
    keywords?: string[];
  };

  /**
   * 工具调用配置（strategy为TOOL或HYBRID时生效）
   */
  toolRetrieval?: {
    /**
     * 是否启用kb_search工具
     */
    enabled: boolean;

    /**
     * 默认检索条数（可选，留空则使用知识库默认配置）
     */
    defaultTopN?: number;

    /**
     * 默认相似度阈值（可选，留空则使用知识库默认配置）
     */
    defaultSimilarityThresh?: number;

    /**
     * 是否允许LLM指定知识库
     */
    allowSpecifyKb: boolean;
  };
}

/**
 * 默认检索配置
 */
export const DEFAULT_KB_RETRIEVAL_CONFIG: KbRetrievalConfig = {
  strategy: KbRetrievalStrategy.HYBRID,
  autoRetrieval: {
    enabled: true,
    showSources: true,
    trigger: 'always',
  },
  toolRetrieval: {
    enabled: true,
    allowSpecifyKb: true,
  },
};

/**
 * 检索结果
 */
export interface RetrievalResult {
  /**
   * 检索是否成功
   */
  success: boolean;

  /**
   * 检索策略
   */
  strategy: KbRetrievalStrategy;

  /**
   * 检索到的知识库内容
   */
  chunks: Array<{
    kbCode: string;
    kbName: string;
    content: string;
    score: number;
    docName: string;
  }>;

  /**
   * 增强后的系统提示词（AUTO模式）
   */
  augmentedSystemPrompt?: string;

  /**
   * 检索耗时（毫秒）
   */
  costMs: number;

  /**
   * 是否来自缓存
   */
  cacheHit?: boolean;
}

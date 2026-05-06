/**
 * AI统一响应格式
 * 屏蔽不同厂商的响应差异
 */

/**
 * 统一AI响应接口
 */
export interface UnifiedAiResponse {
  /** 响应ID */
  id: string;
  /** 响应对象类型 */
  object: string;
  /** 创建时间戳 */
  created: number;
  /** 模型标识 */
  model: string;
  /** 响应内容 */
  choices: UnifiedChoice[];
  /** Token使用统计 */
  usage?: UnifiedUsage;
  /** 提供商原始响应(可选) */
  provider?: string;
}

/**
 * 统一选择项
 */
export interface UnifiedChoice {
  /** 选择项索引 */
  index: number;
  /** 消息内容 */
  message: UnifiedMessage;
  /** 完成原因 */
  finish_reason: string | null;
}

/**
 * 统一消息
 */
export interface UnifiedMessage {
  /** 角色 */
  role: string;
  /** 内容 */
  content: string;
}

/**
 * 统一Token使用统计
 */
export interface UnifiedUsage {
  /** 提示Token数 */
  prompt_tokens: number;
  /** 完成Token数 */
  completion_tokens: number;
  /** 总Token数 */
  total_tokens: number;
}

/**
 * 统一Embedding响应
 */
export interface UnifiedEmbeddingResponse {
  /** 响应对象类型 */
  object: string;
  /** Embedding数据列表 */
  data: UnifiedEmbeddingData[];
  /** 模型标识 */
  model: string;
  /** Token使用统计 */
  usage: UnifiedUsage;
}

/**
 * 统一Embedding数据
 */
export interface UnifiedEmbeddingData {
  /** 数据对象类型 */
  object: string;
  /** 索引 */
  index: number;
  /** 向量数据 */
  embedding: number[];
}

/**
 * 统一图片生成响应
 */
export interface UnifiedImageResponse {
  /** 创建时间戳 */
  created: number;
  /** 图片数据列表 */
  data: UnifiedImageData[];
}

/**
 * 统一图片数据
 */
export interface UnifiedImageData {
  /** 图片URL */
  url?: string;
  /** Base64图片数据 */
  b64_json?: string;
}

/**
 * 统一流式响应块
 */
export interface UnifiedStreamChunk {
  /** 响应ID */
  id: string;
  /** 响应对象类型 */
  object: string;
  /** 创建时间戳 */
  created: number;
  /** 模型标识 */
  model: string;
  /** 选择项列表 */
  choices: UnifiedStreamChoice[];
}

/**
 * 统一流式选择项
 */
export interface UnifiedStreamChoice {
  /** 索引 */
  index: number;
  /** 增量消息 */
  delta: UnifiedStreamDelta;
  /** 完成原因 */
  finish_reason: string | null;
}

/**
 * 统一流式增量
 */
export interface UnifiedStreamDelta {
  /** 角色 */
  role?: string;
  /** 内容 */
  content?: string;
}

import type { ReasoningStep } from './reasoning'

/**
 * 检索结果项
 */
export interface RetrievalItem {
  /** 分块ID */
  chunkId: string
  /** 内容 */
  content: string
  /** 相似度分数 */
  score: number
  /** 文档名称 */
  docName: string
  /** 文档ID */
  docId: string
  /** 分块索引 */
  chunkIndex?: number
  /** 元数据 */
  metadata?: any
}

/**
 * 检索响应
 */
export interface RetrievalResponse {
  /** 检索结果列表 */
  list: RetrievalItem[]
  /** 查询文本 */
  query: string
  /** 知识库ID */
  kbId: string
  /** 总数 */
  total: number
  /** 耗时 */
  costTime?: number
  /** 是否缓存命中 */
  cacheHit?: boolean
  /** 检索方法 */
  method?: string
}

/**
 * 消息接口
 */
export interface Message {
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 消息内容 */
  content: string
  /** 思考过程内容 */
  thinkingContent?: string
  /** 推理步骤 */
  reasoningSteps?: ReasoningStep[]
  /** 消息类型 */
  type?: 'rag' | 'retrieval'
  /** 参考来源 */
  sources?: RetrievalItem[]
  /** 检索结果 */
  results?: RetrievalItem[]
  /** 消息时间戳 */
  timestamp?: number | string
}
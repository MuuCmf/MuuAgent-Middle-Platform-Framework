import type { ReasoningStep } from './reasoning'

/**
 * 内容块类型
 * 对应服务端的 content_block 概念
 */
export type ContentBlockType = 'text' | 'tool_call' | 'thinking'

/**
 * 内容块状态
 */
export type ContentBlockStatus = 'pending' | 'streaming' | 'running' | 'completed' | 'error'

/**
 * 内容块接口
 * 服务端通过 content_block_start/content_block_stop 事件下发
 */
export interface ContentBlock {
  /** 内容块类型 */
  type: ContentBlockType
  /** 块索引 */
  index: number
  /** 文本内容（text 类型使用） */
  content: string
  /** 工具名称（tool_call 类型使用） */
  toolName?: string
  /** 工具参数 */
  toolArgs?: Record<string, unknown>
  /** 工具执行结果 */
  toolResult?: unknown
  /** 工具执行状态 */
  toolStatus?: ContentBlockStatus
  /** 推理步骤列表（thinking 类型使用） */
  reasoningSteps?: ReasoningStep[]
}

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
  /** 推理步骤（ReAct 模式使用） */
  reasoningSteps?: ReasoningStep[]
  /** 内容块列表（流式 content_block 模式下使用） */
  contentBlocks?: ContentBlock[]
  /** 消息类型 */
  type?: 'rag' | 'retrieval'
  /** 参考来源 */
  sources?: RetrievalItem[]
  /** 检索结果 */
  results?: RetrievalItem[]
  /** 消息时间戳 */
  timestamp?: number | string
}
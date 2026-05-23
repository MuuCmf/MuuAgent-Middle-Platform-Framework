import { fetchEventSource } from '@microsoft/fetch-event-source'
import { httpClient } from '../utils/request'
import { API_CONFIG } from '../api/config'
import { getApiKey, getUid } from '../utils/auth'

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
 * RAG问答响应
 */
export interface RagChatResponse {
  /** 回答内容 */
  answer: string
  /** 参考来源 */
  sources: RetrievalItem[]
  /** 检索数量 */
  retrievalCount: number
  /** 耗时 */
  costTime: number
}

/**
 * RAG流式回调接口
 */
export interface RagStreamCallbacks {
  /** 消息回调 */
  onMessage: (content: string) => void
  /** 错误回调 */
  onError: (error: Error) => void
  /** 完成回调 */
  onComplete: (sources?: RetrievalItem[]) => void
  /** 会话ID回调 */
  onConversationId?: (conversationId: string) => void
}

/**
 * 安全处理文本，修复 Unicode 字符截断问题
 * @param text 原始文本
 * @returns 修复后的文本
 */
function safeTextDecode(text: string): string {
  if (!text) return text

  const lastCharCode = text.charCodeAt(text.length - 1)
  if (lastCharCode >= 0xd800 && lastCharCode <= 0xdbff) {
    return text.slice(0, -1)
  }

  if (text.length >= 2) {
    const secondLastCharCode = text.charCodeAt(text.length - 2)
    const last = text.charCodeAt(text.length - 1)
    if (
      !(secondLastCharCode >= 0xd800 && secondLastCharCode <= 0xdbff && last >= 0xdc00 && last <= 0xdfff) &&
      last >= 0xdc00 &&
      last <= 0xdfff
    ) {
      return text.slice(0, -1)
    }
  }

  return text
}

/**
 * 检索服务
 * 封装向量检索和RAG问答相关的API调用
 */
export class RetrievalService {
  /**
   * 向量检索
   * @param data 检索参数
   * @returns 检索结果
   */
  async retrieval(data: {
    /** 知识库ID */
    kbId: string
    /** 查询文本 */
    query: string
    /** 返回数量 */
    topN?: number
    /** 相似度阈值 */
    similarityThresh?: number
  }): Promise<{ data: RetrievalResponse }> {
    const response = await httpClient.getInstance().post('/api/kb/retrieval', data)
    return { data: response.data.data }
  }

  /**
   * RAG问答（非流式）
   * @param data 问答参数
   * @returns 问答结果
   */
  async ragChat(data: {
    /** 知识库ID */
    kbId: string
    /** 查询文本 */
    query: string
    /** 返回数量 */
    topN?: number
    /** 相似度阈值 */
    similarityThresh?: number
    /** 会话ID */
    conversationId?: string
    /** 模型代码 */
    modelCode?: string
  }): Promise<{ data: RagChatResponse }> {
    const response = await httpClient.getInstance().post('/api/kb/chat/rag', data)
    return { data: response.data.data }
  }

  /**
   * RAG问答流式调用
   * @param data 问答参数
   * @param callbacks 回调函数
   */
  async ragChatStream(
    data: {
      /** 知识库ID */
      kbId: string
      /** 查询文本 */
      query: string
      /** 返回数量 */
      topN?: number
      /** 相似度阈值 */
      similarityThresh?: number
      /** 会话ID */
      conversationId?: string
      /** 模型代码 */
      modelCode?: string
    },
    callbacks: RagStreamCallbacks,
  ): Promise<void> {
    const { onMessage, onError, onComplete, onConversationId } = callbacks
    const abortController = new AbortController()
    let sources: RetrievalItem[] = []

    const baseURL = API_CONFIG.baseURL || window.location.origin

    try {
      await fetchEventSource(`${baseURL}/api/kb/chat/rag/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getApiKey(),
          'x-uid': getUid(),
        },
        body: JSON.stringify(data),
        signal: abortController.signal,

        async onopen(response) {
          if (response.ok) {
            return
          }
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        },

        onmessage(event) {
          if (!event.data) return

          const dataLine = event.data.trim()

          if (dataLine === '[DONE]') {
            onComplete(sources)
            abortController.abort()
            return
          }

          if (dataLine.startsWith('[ERROR]')) {
            const errorMsg = dataLine.replace('[ERROR] ', '')
            onError(new Error(errorMsg))
            abortController.abort()
            return
          }

          try {
            const parsed = JSON.parse(dataLine)

            if (parsed.sources) {
              sources = parsed.sources
            } else if (parsed.conversationId) {
              if (onConversationId) {
                onConversationId(parsed.conversationId)
              }
            } else if (parsed.type === 'text_delta' && parsed.delta) {
              onMessage(parsed.delta)
            } else if (parsed.choices && parsed.choices[0]?.delta?.content) {
              onMessage(safeTextDecode(parsed.choices[0].delta.content))
            } else if (parsed.message) {
              onMessage(safeTextDecode(parsed.message))
            }
          } catch {
            if (dataLine && dataLine.trim()) {
              onMessage(safeTextDecode(dataLine))
            }
          }
        },

        onerror(error) {
          onError(error instanceof Error ? error : new Error('Unknown error'))
          throw error
        },

        onclose() {
          onComplete(sources)
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      onError(error instanceof Error ? error : new Error('Unknown error'))
    }
  }
}

/** 检索服务实例 */
export const retrievalService = new RetrievalService()

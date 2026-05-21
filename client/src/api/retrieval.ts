import { fetchEventSource } from '@microsoft/fetch-event-source'
import { httpClient } from '../utils/request'
import { API_CONFIG } from './config'
import { getApiKey, getUid } from '../utils/auth'

/**
 * 安全处理文本，修复 Unicode 字符截断问题
 * @param text 原始文本
 * @returns 修复后的文本
 */
function safeTextDecode(text: string): string {
  if (!text) return text;
  
  const lastCharCode = text.charCodeAt(text.length - 1);
  if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF) {
    return text.slice(0, -1);
  }
  
  if (text.length >= 2) {
    const secondLastCharCode = text.charCodeAt(text.length - 2);
    const last = text.charCodeAt(text.length - 1);
    if (!(secondLastCharCode >= 0xD800 && secondLastCharCode <= 0xDBFF &&
          last >= 0xDC00 && last <= 0xDFFF) &&
        last >= 0xDC00 && last <= 0xDFFF) {
      return text.slice(0, -1);
    }
  }
  
  return text;
}

/**
 * 检索结果项
 */
export interface RetrievalItem {
  chunkId: string
  content: string
  score: number
  docName: string
  docId: string
  chunkIndex?: number
  metadata?: any
}

/**
 * 检索响应
 */
export interface RetrievalResponse {
  list: RetrievalItem[]
  query: string
  kbId: string
  total: number
  costTime?: number
  cacheHit?: boolean
  method?: string
}

/**
 * RAG问答响应
 */
export interface RagChatResponse {
  answer: string
  sources: RetrievalItem[]
  retrievalCount: number
  costTime: number
}

/**
 * RAG流式回调接口
 */
export interface RagStreamCallbacks {
  onMessage: (content: string) => void
  onError: (error: Error) => void
  onComplete: (sources?: RetrievalItem[]) => void
  onConversationId?: (conversationId: string) => void
}

/**
 * 检索API
 */
export const retrievalApi = {
  /**
   * 向量检索
   * @param data 检索参数
   * @returns {Promise<any>} 检索结果
   */
  async retrieval(data: {
    kbId: string
    query: string
    topN?: number
    similarityThresh?: number
  }): Promise<{ data: RetrievalResponse }> {
    const response = await httpClient.getInstance().post('/api/kb/retrieval', data)
    return { data: response.data.data }
  },

  /**
   * RAG问答（非流式）
   * @param data 问答参数
   * @returns {Promise<any>} 问答结果
   */
  async ragChat(data: {
    kbId: string
    query: string
    topN?: number
    similarityThresh?: number
    conversationId?: string
    modelCode?: string
  }): Promise<{ data: RagChatResponse }> {
    const response = await httpClient.getInstance().post('/api/kb/chat/rag', data)
    return { data: response.data.data }
  },

  /**
   * RAG问答流式调用
   * @param data 问答参数
   * @param callbacks 回调函数
   */
  async ragChatStream(
    data: {
      kbId: string
      query: string
      topN?: number
      similarityThresh?: number
      conversationId?: string
      modelCode?: string
    },
    callbacks: RagStreamCallbacks
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
  },
}

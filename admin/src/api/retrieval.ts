import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import { appConfig } from '@/config'
import { fetchEventSource } from '@microsoft/fetch-event-source'

/**
 * 检索结果项
 */
export interface RetrievalItem {
  // 检索结果项的唯一标识符
  chunkId: string
  // 检索结果项的内容
  content: string
  // 检索结果项的相似度分数
  // 越高表示越相关
  score: number
  // 检索结果项所属的文档名称
  docName: string
  // 检索结果项所属的文档唯一标识符
  docId: string
  // 检索结果项的元数据
  metadata?: any
}

/**
 * 检索响应
 * 包含检索结果项、查询、知识库ID和总结果数
 */
export interface RetrievalResponse {
  // 检索结果项列表
  list: RetrievalItem[]
  // 检索查询的文本
  query: string
  // 知识库的唯一标识符
  kbId: string
  // 总结果数
  total: number
}

/**
 * RAG问答响应
 * 包含问答响应、问答来源、问答查询和问答库ID
 */
export interface RagChatResponse {
  // 问答响应的文本
  response: string
  // 问答来源的检索结果项列表
  // 每个检索结果项包含文档名称、文档唯一标识符、相似度分数和元数据
  sources: RetrievalItem[]
  // 问答查询的文本
  query: string
  // 问答库的唯一标识符
  kbId: string
}

/**
 * 检索API
 */
export const retrievalApi = {
  /**
   * 向量检索
   * @param data 检索参数
   * @returns {Promise<AxiosResponse>} 检索结果
   */
  retrieval(data: {
    kbId: string
    query: string
    topN?: number
    similarityThresh?: number
  }): Promise<AxiosResponse<{ data: RetrievalResponse }>> {
    return request.post('api/kb/retrieval', data)
  },

  /**
   * RAG问答
   * @param data 问答参数
   * @returns {Promise<AxiosResponse>} 问答结果
   */
  ragChat(data: {
    kbId: string
    query: string
    topN?: number
    similarityThresh?: number
  }): Promise<AxiosResponse<{ data: RagChatResponse }>> {
    return request.post('api/kb/chat/rag', data)
  },

  /**
   * RAG问答流式回调接口
   */
  interface RagStreamCallbacks {
    onMessage: (content: string) => void
    onError?: (error: Error) => void
    onComplete?: (sources?: any[]) => void
    onConversationId?: (conversationId: string) => void
  }

  /**
   * RAG问答流式调用（使用 @microsoft/fetch-event-source）
   * 自动处理 SSE 连接、重试和错误
   */
  async ragChatStream(
    data: {
      kbId: string
      query: string
      topN?: number
      similarityThresh?: number
    },
    callbacks: RagStreamCallbacks
  ): Promise<void> {
    const { onMessage, onError, onComplete, onConversationId } = callbacks
    console.log('[RAG Stream] 发送请求:', `${appConfig.apiBaseUrl}/kb/chat/rag/stream`, data)

    const abortController = new AbortController()
    let sources: any[] = []

    try {
      await fetchEventSource(`${appConfig.apiBaseUrl}/kb/chat/rag/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': appConfig.apiKey
        },
        body: JSON.stringify(data),
        signal: abortController.signal,

        /**
         * 连接打开时的回调
         */
        async onopen(response) {
          console.log('[RAG Stream] 响应状态:', response.status, response.statusText)
          if (response.ok) {
            console.log('[RAG Stream] SSE connection opened')
            return
          }
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorData = await response.json()
            throw new Error(errorData.message || `HTTP ${response.status}`)
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        },

        /**
         * 收到消息时的回调
         */
        onmessage(event) {
          if (!event.data) {
            return
          }

          const dataLine = event.data.trim()
          console.log('[RAG Stream] 数据行:', dataLine.substring(0, 100) + (dataLine.length > 100 ? '...' : ''))

          if (dataLine === '[DONE]') {
            if (onComplete) onComplete(sources)
            abortController.abort()
            return
          }

          if (dataLine.startsWith('[ERROR]')) {
            const errorMsg = dataLine.replace('[ERROR] ', '')
            if (onError) onError(new Error(errorMsg))
            abortController.abort()
            return
          }

          try {
            const parsed = JSON.parse(dataLine)
            console.log('[RAG Stream] 解析结果:', parsed)

            if (parsed.conversationId) {
              if (onConversationId) {
                onConversationId(parsed.conversationId)
                console.log('[RAG Stream] 收到conversationId:', parsed.conversationId)
              }
            } else if (parsed.sources) {
              sources = parsed.sources
              console.log('[RAG Stream] 更新sources:', sources.length)
            } else if (parsed.choices && parsed.choices[0]?.delta?.content) {
              onMessage(parsed.choices[0].delta.content)
              console.log('[RAG Stream] 发送消息:', parsed.choices[0].delta.content.substring(0, 50))
            } else if (parsed.choices && parsed.choices[0]?.message?.content) {
              onMessage(parsed.choices[0].message.content)
            } else if (parsed.message) {
              onMessage(parsed.message)
            } else if (parsed.content) {
              onMessage(parsed.content)
            } else {
              console.warn('[RAG Stream] 未匹配任何内容格式:', parsed)
            }
          } catch (parseError) {
            console.warn('RAG流式数据解析失败:', dataLine.substring(0, 100), parseError)
          }
        },

        /**
         * 发生错误时的回调
         */
        onerror(error) {
          console.error('[RAG Stream] SSE error:', error)
          if (error instanceof Error) {
            if (onError) onError(error)
          } else {
            if (onError) onError(new Error('SSE connection error'))
          }
          throw error
        },

        /**
         * 关闭连接时的回调
         */
        onclose() {
          console.log('[RAG Stream] SSE connection closed')
        }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[RAG Stream] Request aborted')
        return
      }
      console.error('RAG流式调用错误:', error)
      if (onError) onError(error)
    }
  }
}

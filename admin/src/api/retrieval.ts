import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import { appConfig } from '@/config'

/**
 * 检索结果项
 */
export interface RetrievalItem {
  chunkId: string
  content: string
  score: number
  docName: string
  docId: string
  metadata?: any
}

/**
 * 检索响应
 */
export interface RetrievalResponse {
  results: RetrievalItem[]
  query: string
  kbId: string
  total: number
}

/**
 * RAG问答响应
 */
export interface RagChatResponse {
  response: string
  sources: RetrievalItem[]
  query: string
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
    return request.post('/kb/retrieval', data)
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
    return request.post('/kb/chat/rag', data)
  },

  /**
   * RAG问答流式调用
   * @param data 问答参数
   * @param onMessage 消息回调函数
   * @param onError 错误回调函数
   * @param onComplete 完成回调函数
   * @returns {Promise<void>} Promise
   */
  async ragChatStream(
    data: {
      kbId: string
      query: string
      topN?: number
      similarityThresh?: number
    },
    onMessage: (data: string) => void,
    onError?: (error: any) => void,
    onComplete?: (sources?: any[]) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/kb/chat/rag/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': appConfig.apiKey
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Response body is null')
      }

      let buffer = ''
      let sources: any[] = []

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          
          if (!trimmedLine) {
            continue
          }
          
          if (!trimmedLine.startsWith('data:')) {
            continue
          }
          
          const dataLine = trimmedLine.slice(5).trim()
          
          if (!dataLine) {
            continue
          }
          
          if (dataLine === '[DONE]') {
            if (onComplete) onComplete(sources)
            return
          }

          if (dataLine.startsWith('[ERROR]')) {
            const errorMsg = dataLine.replace('[ERROR] ', '')
            if (onError) onError(new Error(errorMsg))
            return
          }

          try {
            const parsed = JSON.parse(dataLine)
            
            if (parsed.sources) {
              sources = parsed.sources
            } else if (parsed.choices && parsed.choices[0]?.delta?.content) {
              onMessage(parsed.choices[0].delta.content)
            } else if (parsed.choices && parsed.choices[0]?.message?.content) {
              onMessage(parsed.choices[0].message.content)
            } else if (parsed.message) {
              onMessage(parsed.message)
            } else if (parsed.content) {
              onMessage(parsed.content)
            }
          } catch (parseError) {
            console.warn('RAG流式数据解析失败:', dataLine.substring(0, 100), parseError)
          }
        }
      }

      if (onComplete) onComplete(sources)
    } catch (error) {
      console.error('RAG流式调用错误:', error)
      if (onError) onError(error)
    }
  }
}

import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import { appConfig } from '@/config'

export interface AiInvokeParams {
  modelType: string
  modelCode?: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  conversationId?: string
}

export interface AiInvokeResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export const aiApi = {
  /**
   * 普通AI调用（非流式）
   * @param params 调用参数
   * @returns {Promise<AxiosResponse>} 调用结果
   */
  invoke(params: AiInvokeParams): Promise<AxiosResponse<{ data: AiInvokeResponse }>> {
    return request.post('/ai/invoke', params)
  },

  /**
   * SSE流式调用
   * @param params 调用参数
   * @param onMessage 消息回调函数
   * @param onError 错误回调函数
   * @param onComplete 完成回调函数
   * @param onConversationId 会话ID回调函数
   * @returns {Promise<void>} Promise
   */
  async stream(
    params: AiInvokeParams,
    onMessage: (data: string) => void,
    onError?: (error: any) => void,
    onComplete?: () => void,
    onConversationId?: (conversationId: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': appConfig.apiKey
        },
        body: JSON.stringify(params)
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

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // 按换行符分割数据（后端发送的是纯JSON，每行一个）
        const lines = buffer.split('\n')
        
        // 保留最后一个不完整的行
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          
          // 跳过空行
          if (!trimmedLine) {
            continue
          }
          
          // SSE格式：只处理以 "data:" 开头的行，忽略其他字段（event:, id: 等）
          if (!trimmedLine.startsWith('data:')) {
            continue
          }
          
          // 提取data后面的内容
          const dataLine = trimmedLine.slice(5).trim()
          
          // 跳过空数据行（如 "data:" 或 "data: "）
          if (!dataLine) {
            continue
          }
          
          // 检查是否是 [DONE] 信号
          if (dataLine === '[DONE]') {
            if (onComplete) onComplete()
            return
          }

          // 检查是否是错误信息
          if (dataLine.startsWith('[ERROR]')) {
            const errorMsg = dataLine.replace('[ERROR] ', '')
            if (onError) onError(new Error(errorMsg))
            return
          }

          // 检查是否是会话ID
          if (dataLine.startsWith('[CONVERSATION_ID]')) {
            const conversationId = dataLine.replace('[CONVERSATION_ID]', '').trim()
            if (onConversationId && conversationId) {
              onConversationId(conversationId)
            }
            continue
          }

          // 尝试解析JSON数据
          try {
            const parsed = JSON.parse(dataLine)
            
            // 检查是否包含会话ID
            if (parsed.conversationId && onConversationId) {
              onConversationId(parsed.conversationId)
            }
            
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              onMessage(parsed.choices[0].delta.content)
            } else if (parsed.choices && parsed.choices[0]?.message?.content) {
              onMessage(parsed.choices[0].message.content)
            } else if (parsed.message) {
              onMessage(parsed.message)
            }
          } catch (parseError) {
            console.warn('SSE数据解析失败:', dataLine.substring(0, 100), parseError)
          }
        }
      }

      if (onComplete) onComplete()
    } catch (error) {
      console.error('流式调用错误:', error)
      if (onError) onError(error)
    }
  }
}

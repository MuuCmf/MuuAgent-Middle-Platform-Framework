import { httpClient } from './request'
import { API_ENDPOINTS } from './config'
import { streamRequest } from './stream'

/**
 * 消息接口
 */
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * 流式聊天参数
 */
export interface StreamChatParams {
  modelType?: string
  modelCode?: string
  messages: Message[]
  conversationId?: string | null
}

/**
 * AI API服务
 */
export const aiApi = {
  /**
   * 流式聊天（POST请求）
   * @param params 聊天参数
   * @param onMessage 消息回调
   * @param onError 错误回调
   * @param onComplete 完成回调
   * @param onConversationId 会话ID回调
   */
  async streamChat(
    params: StreamChatParams,
    onMessage: (content: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void,
    onConversationId?: (conversationId: string) => void
  ): Promise<void> {
    const baseURL = import.meta.env.VITE_API_BASE_URL || ''
    const url = `${baseURL}${API_ENDPOINTS.chat}`

    await streamRequest({
      url,
      body: {
        modelType: params.modelType || 'llm',
        modelCode: params.modelCode,
        conversationId: params.conversationId,
        messages: params.messages,
      },
      callbacks: {
        onMessage,
        onError,
        onComplete,
        onConversationId,
      },
    })
  },

  /**
   * 获取模型列表
   */
  async getModels() {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.models)
    return response.data
  },
}

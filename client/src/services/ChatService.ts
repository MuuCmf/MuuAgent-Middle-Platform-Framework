import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from '../api/config'
import { streamRequest } from '../api/stream'
import type { ReasoningStep } from '../api/reasoning'
import type { ClientToolCallPayload } from '../api/stream'
import type { ClientToolModulePolicy } from '../executor/types'
import type { Message } from '../api/ai'

/**
 * 流式聊天参数
 */
export interface StreamChatParams {
  /** 模型类型 */
  modelType?: string
  /** 模型代码 */
  modelCode?: string
  /** 消息列表 */
  messages: Message[]
  /** 会话ID */
  conversationId?: string | null
}

/**
 * 流式聊天回调接口
 */
export interface StreamChatCallbacks {
  /** 消息回调 */
  onMessage: (content: string) => void
  /** 错误回调 */
  onError: (error: Error) => void
  /** 完成回调 */
  onComplete: () => void
  /** 会话ID回调 */
  onConversationId?: (conversationId: string) => void
}

/**
 * AI聊天服务
 * 封装AI模型相关的API调用
 */
export class ChatService {
  /**
   * 流式聊天
   * @param params 聊天参数
   * @param callbacks 回调函数
   * @param signal 取消信号
   */
  async streamChat(
    params: StreamChatParams,
    callbacks: StreamChatCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const baseURL = window.location.origin || ''
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
        onMessage: callbacks.onMessage,
        onError: callbacks.onError,
        onComplete: callbacks.onComplete,
        onConversationId: callbacks.onConversationId,
      },
      signal,
    })
  }

  /**
   * 获取模型列表
   * @returns 模型列表
   */
  async getModels() {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.models)
    return response.data
  }
}

/** AI聊天服务实例 */
export const chatService = new ChatService()

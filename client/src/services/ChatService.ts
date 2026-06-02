import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from '../api/config'
import { streamRequest, type StreamCallbacks } from '../api/stream'
import type { Message } from '../api/types'

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

/** 流式聊天回调接口（直接使用 StreamCallbacks） */
export type StreamChatCallbacks = StreamCallbacks

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
      callbacks,
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

  /**
   * 上传文件
   * @param file 文件对象
   * @param fileType 文件类型（image/video/file）
   * @returns 上传结果（包含文件URL等）
   */
  async uploadFile(file: File, fileType: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessType', fileType === 'image' ? 'image' : 'file')

    const response = await httpClient.getInstance().post(
      API_ENDPOINTS.fileUpload,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )
    return response.data
  }
}

/** AI聊天服务实例 */
export const chatService = new ChatService()

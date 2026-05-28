import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

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
    return request.post('/api/ai/invoke', params)
  }
}

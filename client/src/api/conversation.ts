import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from './config'

/**
 * 会话接口
 */
export interface Conversation {
  id: string
  conversationType: string
  targetId: string
  title: string
  status: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

/**
 * 会话API服务
 */
export const conversationApi = {
  /**
   * 获取会话列表
   */
  async getList(params?: {
    conversationType?: string
    targetId?: string
    page?: number
    pageSize?: number
  }) {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.conversations, {
      params,
    })
    return response.data
  },

  /**
   * 获取会话详情
   */
  async getDetail(id: string) {
    const response = await httpClient.getInstance().get(`${API_ENDPOINTS.conversations}/${id}`)
    return response.data
  },

  /**
   * 删除会话
   */
  async delete(id: string) {
    const response = await httpClient.getInstance().delete(`${API_ENDPOINTS.conversations}/${id}`)
    return response.data
  },

  /**
   * 更新会话
   */
  async update(id: string, data: { title?: string }) {
    const response = await httpClient.getInstance().patch(
      `${API_ENDPOINTS.conversations}/${id}`,
      data
    )
    return response.data
  },
}

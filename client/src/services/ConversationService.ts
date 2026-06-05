import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from '../api/config'

/**
 * 会话接口
 */
export interface Conversation {
  /** 会话ID */
  id: string
  /** 会话类型 */
  conversationType: string
  /** 目标ID */
  targetId: string
  /** 标题 */
  title: string
  /** 状态 */
  status: string
  /** 消息数量 */
  messageCount: number
  /** 最后消息时间 */
  lastMessageAt: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 会话列表查询参数
 */
export interface ConversationListParams {
  /** 会话类型 */
  conversationType?: string
  /** 目标ID */
  targetId?: string
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
}

/**
 * 创建会话参数
 */
export interface CreateConversationParams {
  /** 会话类型 */
  conversationType: string
  /** 目标ID（智能体ID/模型标识/知识库ID） */
  targetId: string
  /** 会话标题（可选） */
  title?: string
}

/**
 * 会话服务
 * 封装会话相关的API调用
 */
export class ConversationService {
  /**
   * 创建会话
   * @param data 创建参数
   * @returns 创建结果
   */
  async create(data: CreateConversationParams) {
    const response = await httpClient.getInstance().post(API_ENDPOINTS.conversations, data)
    return response.data
  }

  /**
   * 获取会话列表
   * @param params 查询参数
   * @returns 会话列表
   */
  async getList(params?: ConversationListParams) {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.conversations, {
      params,
    })
    return response.data
  }

  /**
   * 获取会话详情
   * @param id 会话ID
   * @returns 会话详情
   */
  async getDetail(id: string) {
    const response = await httpClient.getInstance().get(`${API_ENDPOINTS.conversations}/${id}`)
    return response.data
  }

  /**
   * 删除会话
   * @param id 会话ID
   * @returns 删除结果
   */
  async delete(id: string) {
    const response = await httpClient.getInstance().delete(`${API_ENDPOINTS.conversations}/${id}`)
    return response.data
  }

  /**
   * 更新会话
   * @param id 会话ID
   * @param data 更新数据
   * @returns 更新结果
   */
  async update(id: string, data: { title?: string }) {
    const response = await httpClient.getInstance().patch(
      `${API_ENDPOINTS.conversations}/${id}`,
      data,
    )
    return response.data
  }
}

/** 会话服务实例 */
export const conversationService = new ConversationService()

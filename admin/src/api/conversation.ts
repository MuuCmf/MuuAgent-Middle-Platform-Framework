import request from '@/utils/request'

/**
 * 会话类型枚举
 */
export enum ConversationType {
  AGENT = 'agent',
  MODEL = 'model',
  KB_RAG = 'kb-rag',
}

/**
 * 会话状态枚举
 */
export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

/**
 * 会话接口
 */
export interface Conversation {
  id: string
  conversationType: ConversationType
  targetId: string
  title: string | null
  status: ConversationStatus
  uid: string | null
  messageCount: number
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 消息接口
 */
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls: string | null
  toolCallId: string | null
  tokenCount: number | null
  reasoningSteps: string | null
  metadata: string | null
  createdAt: Date
}

/**
 * 会话查询参数
 */
export interface QueryConversationParams {
  conversationType?: ConversationType
  targetId?: string
  status?: ConversationStatus
  uid?: string
  page?: number
  pageSize?: number
}

/**
 * 创建会话参数
 */
export interface CreateConversationParams {
  conversationType: ConversationType
  targetId: string
  title?: string
  uid?: string
}

/**
 * 更新会话参数
 */
export interface UpdateConversationParams {
  title?: string
  status?: ConversationStatus
}

/**
 * 会话列表响应
 */
export interface ConversationListResponse {
  list: Conversation[]
  total: number
  page: number
  pageSize: number
}

/**
 * 会话详情响应（包含消息）
 */
export interface ConversationDetailResponse {
  conversation: Conversation
  messages: Message[]
}

/**
 * 会话API
 */
export const conversationApi = {
  /**
   * 获取会话列表
   * @param params 查询参数
   * @returns 会话列表
   */
  async getList(params?: QueryConversationParams): Promise<ConversationListResponse> {
    const response = await request.get('/conversation', { params })
    return response.data.data
  },

  /**
   * 获取会话详情
   * @param id 会话ID
   * @param messageLimit 消息数量限制
   * @returns 会话详情
   */
  async getDetail(id: string, messageLimit?: number): Promise<ConversationDetailResponse> {
    const params = messageLimit ? { messageLimit } : {}
    const response = await request.get(`/conversation/${id}`, { params })
    return response.data.data
  },

  /**
   * 创建会话
   * @param data 创建参数
   * @returns 创建的会话
   */
  async create(data: CreateConversationParams): Promise<Conversation> {
    const response = await request.post('/conversation', data)
    return response.data.data
  },

  /**
   * 更新会话
   * @param id 会话ID
   * @param data 更新参数
   * @returns 更新后的会话
   */
  async update(id: string, data: UpdateConversationParams): Promise<Conversation> {
    const response = await request.patch(`/conversation/${id}`, data)
    return response.data.data
  },

  /**
   * 删除会话
   * @param id 会话ID
   */
  async delete(id: string): Promise<void> {
    await request.delete(`/conversation/${id}`)
  },

  /**
   * 获取会话消息
   * @param id 会话ID
   * @param limit 消息数量限制
   * @returns 消息列表
   */
  async getMessages(id: string, limit?: number): Promise<Message[]> {
    const params = limit ? { limit } : {}
    const response = await request.get(`/conversation/${id}/messages`, { params })
    return response.data.data
  },

  /**
   * 生成会话标题
   * @param id 会话ID
   * @returns 生成的标题
   */
  async generateTitle(id: string): Promise<{ title: string }> {
    const response = await request.post(`/conversation/${id}/generate-title`)
    return response.data.data
  },
}

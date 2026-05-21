import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from './config'
import { streamRequest } from './stream'
import type { ReasoningStep } from './reasoning'
import type { WorkspaceToolCallPayload } from './workspace'

/**
 * 智能体接口
 */
export interface Agent {
  id: string
  name: string
  code: string
  description?: string
  systemPrompt?: string
  modelId?: string
  skills?: string
  tools?: string
  reasoningMode?: string
  workspaceConfig?: string
  status: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 智能体API服务
 */
export const agentApi = {
  /**
   * 获取智能体列表
   */
  async getList() {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.agents)
    return response.data
  },

  /**
   * 获取智能体详情
   */
  async getDetail(code: string) {
    const response = await httpClient.getInstance().get(`${API_ENDPOINTS.agents}/${code}`)
    return response.data
  },

  /**
   * 智能体对话（流式）
   */
  async streamChat(
    params: {
      agentId: string
      message: string
      conversationId?: string | null
      modelCode?: string
      showReasoning?: boolean
      workspace?: {
        dirName: string
        treeSummary: string
      }
    },
    onMessage: (content: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void,
    onConversationId?: (conversationId: string) => void,
    onReasoningStep?: (step: ReasoningStep) => void,
    onWorkspaceToolCall?: (payload: WorkspaceToolCallPayload) => void,
  ): Promise<void> {
    const baseURL = window.location.origin
    const url = `${baseURL}${API_ENDPOINTS.agents}/chat/stream`

    await streamRequest({
      url,
      body: params,
      callbacks: {
        onMessage,
        onError,
        onComplete,
        onConversationId,
        onReasoningStep,
        onWorkspaceToolCall,
      },
    })
  },
}

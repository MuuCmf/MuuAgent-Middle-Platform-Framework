import { httpClient } from '../utils/request'
import { API_ENDPOINTS } from '../api/config'
import { streamRequest, type ClientToolCallPayload } from '../api/stream'
import type { ReasoningStep } from '../api/reasoning'
import type { ClientToolModulePolicy } from '../executor/types'

/**
 * 智能体接口
 */
export interface Agent {
  /** 智能体ID */
  id: string
  /** 智能体名称 */
  name: string
  /** 智能体代码 */
  code: string
  /** 描述 */
  description?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 模型ID */
  modelId?: string
  /** 技能 */
  skills?: string
  /** 工具 */
  tools?: string
  /** 推理模式 */
  reasoningMode?: string
  /** 状态 */
  status: boolean
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 智能体流式聊天参数
 */
export interface AgentStreamChatParams {
  /** 智能体ID */
  agentId: string
  /** 消息内容 */
  message: string
  /** 会话ID */
  conversationId?: string | null
  /** 模型代码 */
  modelCode?: string
  /** 是否显示推理过程 */
  showReasoning?: boolean
  /** 工作目录信息 */
  workspace?: {
    /** 目录名称 */
    dirName: string
    /** 目录树摘要 */
    treeSummary: string
  }
}

/**
 * 智能体流式聊天回调接口
 */
export interface AgentStreamChatCallbacks {
  /** 消息回调 */
  onMessage: (content: string) => void
  /** 错误回调 */
  onError: (error: Error) => void
  /** 完成回调 */
  onComplete: () => void
  /** 会话ID回调 */
  onConversationId?: (conversationId: string) => void
  /** 推理步骤回调 */
  onReasoningStep?: (step: ReasoningStep) => void
  /** 客户端工具调用回调 */
  onClientToolCall?: (payload: ClientToolCallPayload) => void
  /** 客户端工具权限策略回调 */
  onClientToolPolicy?: (policies: ClientToolModulePolicy[]) => void
}

/**
 * 智能体服务
 * 封装智能体相关的API调用
 */
export class AgentService {
  /**
   * 获取智能体列表
   * @returns 智能体列表
   */
  async getList() {
    const response = await httpClient.getInstance().get(API_ENDPOINTS.agents)
    return response.data
  }

  /**
   * 获取智能体详情
   * @param code 智能体代码
   * @returns 智能体详情
   */
  async getDetail(code: string) {
    const response = await httpClient.getInstance().get(`${API_ENDPOINTS.agents}/${code}`)
    return response.data
  }

  /**
   * 智能体流式聊天
   * @param params 聊天参数
   * @param callbacks 回调函数
   * @param signal 取消信号
   */
  async streamChat(
    params: AgentStreamChatParams,
    callbacks: AgentStreamChatCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const baseURL = window.location.origin
    const url = `${baseURL}${API_ENDPOINTS.agents}/chat/stream`

    await streamRequest({
      url,
      body: params,
      callbacks: {
        onMessage: callbacks.onMessage,
        onError: callbacks.onError,
        onComplete: callbacks.onComplete,
        onConversationId: callbacks.onConversationId,
        onReasoningStep: callbacks.onReasoningStep,
        onClientToolCall: callbacks.onClientToolCall,
        onClientToolPolicy: callbacks.onClientToolPolicy,
      },
      signal,
    })
  }
}

/** 智能体服务实例 */
export const agentService = new AgentService()

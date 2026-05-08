import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import type { ReasoningStep } from './agent'

export interface Log {
  id: string
  modelId?: string
  modelCode: string
  modelType: string
  request: string
  response?: string
  costMs: number
  inputTokens?: number
  outputTokens?: number
  success: boolean
  errorMessage?: string
  clientIp?: string
  userAgent?: string
  createdAt: string
  model?: {
    id: string
    name: string
    code: string
    provider: string
    type?: string
  }
}

export interface Statistics {
  ai?: {
    total: number
    successRate: number
  }
  skill?: {
    total: number
  }
  agent?: {
    total: number
  }
  modelTypeStats: Array<{
    modelType: string
    count: number
  }>
  modelStats: Array<{
    modelCode: string
    count: number
    avgCostMs: number
  }>
}

export interface SkillLog {
  id: string
  skillId: string
  skillName: string
  skillCode: string
  request: string
  response?: string
  costMs: number
  success: boolean
  errorMessage?: string
  clientIp?: string
  userAgent?: string
  createdAt: string
}

export interface AgentLog {
  id: string
  agentId: string
  userMessage?: string
  agentResponse?: string
  request: string
  response?: string
  steps?: string
  totalCostMs?: number
  costMs: number
  success: boolean
  errorMessage?: string
  clientIp?: string
  userAgent?: string
  createdAt: string
  inputTokens?: number
  outputTokens?: number
  reasoningMode?: string
  reasoningSteps?: ReasoningStep[]
  agent?: {
    id: string
    name: string
    code: string
  }
}

export interface RetrievalLog {
  id: string
  kbId: string
  uid?: string
  query: string
  topN?: number
  similarityThresh?: number
  retrievalCount?: number
  costTime: number
  requestId?: string
  clientIp?: string
  createdAt: string
  kbInfo?: {
    id: string
    kbName: string
  }
}

export const logApi = {
  /**
   * 获取AI调用日志列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 日志列表响应
   */
  getAiLogs(params?: {
    modelId?: string
    modelCode?: string
    modelType?: string
    success?: boolean
    startTime?: string
    endTime?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<{ data: { list: Log[]; total: number; page: number; pageSize: number } }>> {
    return adminRequest.get('/admin/log/ai', { params })
  },

  /**
   * 获取单个AI调用日志详情
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 日志详情响应
   */
  getAiLogById(id: string): Promise<AxiosResponse<{ data: Log }>> {
    return adminRequest.get(`/admin/log/ai/${id}`)
  },

  /**
   * 获取技能调用日志列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 日志列表响应
   */
  getSkillLogs(params?: {
    skillId?: string
    skillCode?: string
    success?: boolean
    startTime?: string
    endTime?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<{ data: { list: SkillLog[]; total: number; page: number; pageSize: number } }>> {
    return adminRequest.get('/admin/log/skill', { params })
  },

  /**
   * 获取Agent调用日志列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 日志列表响应
   */
  getAgentLogs(params?: {
    agentId?: string
    agentCode?: string
    success?: boolean
    startTime?: string
    endTime?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<{ data: { list: AgentLog[]; total: number; page: number; pageSize: number } }>> {
    return adminRequest.get('/admin/log/agent', { params })
  },

  /**
   * 获取单个Agent调用日志详情
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 日志详情响应
   */
  getAgentLogById(id: string): Promise<AxiosResponse<{ data: AgentLog }>> {
    return adminRequest.get(`/admin/log/agent/${id}`)
  },

  /**
   * 获取Agent调用日志的推理步骤
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 推理步骤响应
   */
  getAgentLogReasoningSteps(id: string): Promise<AxiosResponse<{ data: { agentLogId: string; reasoningMode: string; steps: ReasoningStep[] } }>> {
    return adminRequest.get(`/admin/log/agent/${id}/reasoning`)
  },

  /**
   * 获取单个Skill调用日志详情
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 日志详情响应
   */
  getSkillLogById(id: string): Promise<AxiosResponse<{ data: SkillLog }>> {
    return adminRequest.get(`/admin/log/skill/${id}`)
  },

  /**
   * 获取知识库检索日志列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 日志列表响应
   */
  getRetrievalLogs(params?: {
    kbId?: string
    startTime?: string
    endTime?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<{ data: { list: RetrievalLog[]; total: number; page: number; pageSize: number } }>> {
    return adminRequest.get('/admin/log/retrieval', { params })
  },

  /**
   * 获取单个知识库检索日志详情
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 日志详情响应
   */
  getRetrievalLogById(id: string): Promise<AxiosResponse<{ data: RetrievalLog }>> {
    return adminRequest.get(`/admin/log/retrieval/${id}`)
  },

  /**
   * 获取调用统计
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<AxiosResponse>} 统计数据响应
   */
  getStatistics(startTime?: string, endTime?: string): Promise<AxiosResponse<{ data: Statistics }>> {
    return adminRequest.get('/admin/log/statistics', {
      params: { startTime, endTime },
    })
  },
}

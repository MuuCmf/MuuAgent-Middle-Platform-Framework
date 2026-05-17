import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface WorkspaceAgentConfig {
  enabled: boolean
  allowedOperations?: string[]
  maxFileSize?: number
  deniedExtensions?: string[]
}

export interface CustomModelParams {
  temperature?: number
  topP?: number
  maxTokens?: number
  contextWindow?: number
}

export interface Agent {
  id: number
  name: string
  code: string
  description?: string
  systemPrompt: string
  skills: string
  mcpServers?: string
  knowledgeBases?: string
  maxSteps: number
  status: boolean
  modelTemplateCode?: string
  customModelParams?: string
  reasoningMode?: string
  reasoningPrompt?: string
  kbRetrievalMode?: string
  kbRetrievalMethod?: string
  workspaceConfig?: WorkspaceAgentConfig | string
  appCode?: string
  isPublic?: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentForm {
  name: string
  code: string
  description?: string
  systemPrompt: string
  skills: string
  mcpServers?: string
  knowledgeBases?: string
  maxSteps: number
  status: boolean
  modelTemplateCode?: string
  customModelParams?: string
  reasoningMode?: string
  reasoningPrompt?: string
  kbRetrievalMode?: string
  kbRetrievalMethod?: string
  workspaceConfig: WorkspaceAgentConfig
  appCode?: string
  isPublic?: boolean
}

export interface AgentListResponse {
  list: Agent[]
  total: number
}

export interface ReasoningStep {
  id?: string
  stepNumber: number
  stepType: 'thought' | 'action' | 'observation' | 'final_answer' | 'tool-call'
  content?: string
  thought?: string
  action?: string
  actionInput?: any
  observation?: string
  toolOutput?: any
  toolName?: string
  toolArgs?: any
  toolCallId?: string
  args?: any
  costMs?: number
  createdAt?: string
}

export const agentApi = {
  getList(): Promise<AxiosResponse<{ data: AgentListResponse }>> {
    return adminRequest.get('api/admin/agent')
  },

  create(data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.post('api/admin/agent', data)
  },

  update(id: number, data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.put(`api/admin/agent/${id}`, data)
  },

  delete(id: number): Promise<AxiosResponse> {
    return adminRequest.delete(`api/admin/agent/${id}`)
  }
}

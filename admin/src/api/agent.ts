import { adminRequest, request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface Agent {
  id: number
  name: string
  code: string
  description?: string
  systemPrompt: string
  modelId?: number
  skills: string
  maxSteps: number
  temperature: number
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentForm {
  name: string
  code: string
  description?: string
  systemPrompt: string
  modelId?: number
  skills: string
  maxSteps: number
  temperature: number
  status: boolean
}

export interface AgentListResponse {
  list: Agent[]
  total: number
}

export const agentApi = {
  getList(): Promise<AxiosResponse<{ data: AgentListResponse }>> {
    return adminRequest.get('/admin/agent')
  },
  
  create(data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.post('/admin/agent', data)
  },
  
  update(id: number, data: AgentForm): Promise<AxiosResponse> {
    return adminRequest.put(`/admin/agent/${id}`, data)
  },
  
  delete(id: number): Promise<AxiosResponse> {
    return adminRequest.delete(`/admin/agent/${id}`)
  },
  
  chat(agentId: number, message: string): Promise<AxiosResponse<{ data: { response: string } }>> {
    return request.post('/agent/chat', { agentId, message })
  }
}

import { adminRequest, request } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import { appConfig } from '@/config'

export interface Agent {
  id: number
  name: string
  code: string
  description?: string
  systemPrompt: string
  modelId?: number
  skills: string
  mcpServers?: string
  knowledgeBases?: string
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
  mcpServers?: string
  knowledgeBases?: string
  maxSteps: number
  temperature: number
  status: boolean
}

export interface AgentListResponse {
  list: Agent[]
  total: number
}

export interface AgentStreamResponse {
  type: 'chunk' | 'tool' | 'error' | 'done'
  content?: string
  skill?: string
  result?: any
  steps?: any[]
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
  },

  /**
   * 流式智能体对话
   * @param agentId 智能体ID
   * @param message 用户消息
   * @param onChunk 文本片段回调
   * @param onTool 工具调用回调
   * @param onError 错误回调
   * @param onComplete 完成回调
   */
  async streamChat(
    agentId: number,
    message: string,
    onChunk: (content: string) => void,
    onTool: (skill: string, result: any) => void,
    onError: (error: any) => void,
    onComplete: (steps?: any[]) => void
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      // 添加API密钥
      if (appConfig.apiKey) {
        headers['x-api-key'] = appConfig.apiKey
      }
      
      // 添加认证token
      const token = localStorage.getItem('admin_token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ agentId, message, stream: true }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        
        // 按换行分割消息
        while (buffer.includes('\n')) {
          const index = buffer.indexOf('\n')
          const line = buffer.substring(0, index)
          buffer = buffer.substring(index + 1)

          if (line.trim()) {
            try {
              const data: AgentStreamResponse = JSON.parse(line)
              
              switch (data.type) {
                case 'chunk':
                  onChunk(data.content || '')
                  break
                case 'tool':
                  onTool(data.skill || '', data.result)
                  break
                case 'error':
                  onError(new Error(data.content || '未知错误'))
                  return
                case 'done':
                  onComplete(data.steps)
                  return
              }
            } catch (error) {
              console.error('解析流式响应失败:', line)
            }
          }
        }
      }

      onComplete()
    } catch (error) {
      onError(error)
    }
  }
}

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
  reasoningMode?: string
  reasoningPrompt?: string
  kbRetrievalMode?: string
  kbRetrievalMethod?: string
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
  reasoningMode?: string
  reasoningPrompt?: string
  kbRetrievalMode?: string
  kbRetrievalMethod?: string
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

export interface AgentStreamResponse {
  type: 'chunk' | 'tool' | 'error' | 'done' | 'reasoning_step'
  content?: string
  skill?: string
  name?: string
  result?: any
  args?: any
  steps?: any[]
  step?: ReasoningStep
  reasoningMode?: string
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
   * 流式智能体对话（Vercel AI SDK 兼容版本）
   * 使用标准 SSE 格式：data: {...}
   */
  async streamChat(
    agentId: number,
    message: string,
    onChunk: (content: string) => void,
    onTool: (skill: string, result: any) => void,
    onReasoningStep: (step: ReasoningStep) => void,
    onError: (error: any) => void,
    onComplete: (steps?: any[], response?: string) => void
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (appConfig.apiKey) {
        headers['x-api-key'] = appConfig.apiKey
      }

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
          console.log('[Agent API] Stream completed')
          break
        }

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          if (!trimmedLine.startsWith('data: ')) {
            console.warn('[Agent API] Invalid SSE format, skipping:', trimmedLine.substring(0, 100))
            continue
          }

          const jsonStr = trimmedLine.substring(6)
          try {
            const data: AgentStreamResponse = JSON.parse(jsonStr)
            console.log('[Agent API] Received event type:', data.type)

            switch (data.type) {
              case 'chunk':
                if (data.content === '\x00') {
                  console.log('[Agent API] Reset signal received')
                  onChunk('\x00')
                } else {
                  onChunk(data.content || '')
                }
                break
              case 'tool':
                onTool(data.name || data.skill || '', data.result)
                break
              case 'reasoning_step':
                if (onReasoningStep && data.step) {
                  const step = data.step
                  if (data.name && data.result) {
                    step.toolName = data.name
                    step.toolArgs = data.args
                  }
                  onReasoningStep(step)
                }
                break
              case 'error':
                onError(new Error(data.content || '未知错误'))
                return
              case 'done':
                onComplete(data.steps, data.response)
                return
            }
          } catch (parseError) {
            console.error('[Agent API] Failed to parse SSE data:', parseError, 'Data:', jsonStr.substring(0, 200))
          }
        }
      }

      onComplete()
    } catch (error) {
      onError(error)
    }
  }
}
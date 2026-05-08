import { adminRequest, request } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import { appConfig } from '@/config'
import { fetchEventSource } from '@microsoft/fetch-event-source'

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
  response?: string
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

  chat(agentId: string, message: string): Promise<AxiosResponse<{ data: { response: string } }>> {
    return request.post('/agent/chat', { agentId, message })
  },

  /**
   * 流式智能体对话（使用 @microsoft/fetch-event-source）
   * 自动处理 SSE 连接、重试和错误
   */
  async streamChat(
    agentId: string,
    message: string,
    onChunk: (content: string) => void,
    onTool: (skill: string, result: any) => void,
    onReasoningStep: (step: ReasoningStep) => void,
    onError: (error: any) => void,
    onComplete: (steps?: any[], response?: string) => void
  ): Promise<void> {
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

    const abortController = new AbortController()

    try {
      await fetchEventSource('/api/agent/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ agentId, message, stream: true }),
        credentials: 'include',
        signal: abortController.signal,

        /**
         * 连接打开时的回调
         */
        async onopen(response) {
          if (response.ok) {
            console.log('[Agent API] SSE connection opened')
            return
          }
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        },

        /**
         * 收到消息时的回调
         */
        onmessage(event) {
          if (!event.data) {
            return
          }

          try {
            const data: AgentStreamResponse = JSON.parse(event.data)
            const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
            console.log(`[${timestamp}] [Agent API] Received event type:`, data.type, data.type === 'chunk' ? `content: "${data.content?.substring(0, 20)}..."` : '')

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
                abortController.abort()
                break
              case 'done':
                onComplete(data.steps, data.response)
                abortController.abort()
                break
            }
          } catch (parseError) {
            console.error('[Agent API] Failed to parse SSE data:', parseError, 'Data:', event.data?.substring(0, 200))
          }
        },

        /**
         * 发生错误时的回调
         */
        onerror(error) {
          console.error('[Agent API] SSE error:', error)
          if (error instanceof Error) {
            onError(error)
          } else {
            onError(new Error('SSE connection error'))
          }
          throw error
        },

        /**
         * 关闭连接时的回调
         */
        onclose() {
          console.log('[Agent API] SSE connection closed')
        }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Agent API] Request aborted')
        return
      }
      onError(error)
    }
  }
}

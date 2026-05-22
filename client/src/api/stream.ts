import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ReasoningStep } from './reasoning'
import { getApiKey, getUid } from '../utils/auth'

/**
 * 通用客户端工具调用载荷
 */
export interface ClientToolCallPayload {
  moduleName: string
  callId: string
  toolName: string
  args: Record<string, unknown>
}

/**
 * SSE 流式响应回调接口
 */
export interface StreamCallbacks {
  onMessage: (content: string) => void
  onError: (error: Error) => void
  onComplete: () => void
  onConversationId?: (conversationId: string) => void
  onReasoningStep?: (step: ReasoningStep) => void
  /** 通用客户端工具调用回调 */
  onClientToolCall?: (payload: ClientToolCallPayload) => void
}

/**
 * 流式请求状态
 */
interface StreamState {
  completed: boolean
}

/**
 * SSE 流式请求参数
 */
export interface StreamRequestParams {
  url: string
  body: any
  callbacks: StreamCallbacks
  /** 可选的 AbortSignal，用于取消流式请求 */
  signal?: AbortSignal
}

/**
 * 处理 SSE 流式响应数据
 * @param data 原始数据字符串
 * @param callbacks 回调函数
 * @param state 流式请求状态
 */
function handleSSEData(data: string, callbacks: StreamCallbacks, state?: StreamState): void {
  // 使用安全的完成回调，防止重复调用
  const safeComplete = () => {
    if (state) {
      if (!state.completed) {
        state.completed = true
        callbacks.onComplete()
      }
    } else {
      callbacks.onComplete()
    }
  }

  if (data === '[DONE]') {
    safeComplete()
    return
  }

  if (data.startsWith('[ERROR]')) {
    callbacks.onError(new Error(data.replace('[ERROR] ', '')))
    return
  }

  if (data.startsWith('[CONVERSATION_ID]')) {
    const conversationId = data.replace('[CONVERSATION_ID]', '').trim()
    console.log('[SSE] Received [CONVERSATION_ID] format:', conversationId)
    if (callbacks.onConversationId && conversationId) {
      callbacks.onConversationId(conversationId)
    }
    return
  }

  // 客户端工具调用 [CLIENT_TOOL:moduleName]
  const clientToolMatch = data.match(/^\[CLIENT_TOOL:(\w+)\]\s*(.+)$/s)
  if (clientToolMatch) {
    try {
      const moduleName = clientToolMatch[1]
      const payload = JSON.parse(clientToolMatch[2].trim())
      console.log(`[SSE] Received [CLIENT_TOOL:${moduleName}]:`, payload.toolName, payload.callId)
      const clientPayload: ClientToolCallPayload = { moduleName, ...payload }
      callbacks.onClientToolCall?.(clientPayload)
    } catch (e) {
      console.error('[SSE] Failed to parse CLIENT_TOOL payload:', e)
    }
    return
  }

  try {
    const parsed = JSON.parse(data)
    
    if (typeof parsed === 'string' || typeof parsed === 'number') {
      callbacks.onMessage(String(parsed))
      return
    }
    
    if (parsed.choices && parsed.choices[0]?.delta) {
      const delta = parsed.choices[0].delta
      
      if (delta.content) {
        callbacks.onMessage(delta.content)
      } else if (delta.reasoning_content) {
        callbacks.onMessage(delta.reasoning_content)
      }
    } else if (parsed.choices && parsed.choices[0]?.message?.content) {
      callbacks.onMessage(parsed.choices[0].message.content)
    } else if (parsed.message) {
      callbacks.onMessage(parsed.message)
    } else if (parsed.type === 'conversation_id' && parsed.conversationId) {
      console.log('[SSE] Received JSON conversation_id:', parsed.conversationId)
      if (callbacks.onConversationId) {
        callbacks.onConversationId(parsed.conversationId)
      }
    } else     if (parsed.type === 'text_delta' && parsed.delta) {
      callbacks.onMessage(parsed.delta)
    } else if (parsed.type === 'chunk' && parsed.content) {
      callbacks.onMessage(parsed.content)
    } else if (parsed.type === 'reasoning_step' && parsed.step) {
      if (callbacks.onReasoningStep) {
        const step = parsed.step
        if (parsed.name && parsed.result) {
          step.toolName = parsed.name
          step.toolArgs = parsed.args
        }
        callbacks.onReasoningStep(step)
      }
    } else if (parsed.type === 'error' && parsed.content) {
      callbacks.onError(new Error(parsed.content))
    } else if (parsed.type === 'done') {
      safeComplete()
    }
  } catch (e) {
    callbacks.onMessage(data)
  }
}

/**
 * 发起 SSE 流式请求
 * @param params 请求参数
 */
export async function streamRequest(params: StreamRequestParams): Promise<void> {
  const { url, body, callbacks, signal } = params

  console.log('[SSE] Initiating stream request to:', url)

  // 防止 onComplete 被调用多次
  const state: StreamState = { completed: false }

  /** 安全的完成回调 */
  const safeComplete = () => {
    if (!state.completed) {
      state.completed = true
      callbacks.onComplete()
    }
  }

  /** 检查是否已被用户取消 */
  const isAborted = () => signal?.aborted ?? false

  try {
    await fetchEventSource(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'x-uid': getUid(),
      },
      body: JSON.stringify(body),
      signal,
      async onopen(response) {
        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
          return
        }
        const errorText = await response.text()
        console.error('[SSE] Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      },
      onmessage(msg) {
        if (isAborted()) return
        if (msg.data) {
          handleSSEData(msg.data, callbacks, state)
        }
      },
      onerror(err) {
        if (isAborted()) {
          console.log('[SSE] Stream aborted by user')
          safeComplete()
          return
        }
        console.error('[SSE] Stream error:', err)
        callbacks.onError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      },
      onclose() {
        if (isAborted()) return
        safeComplete()
      },
    })
  } catch (error: any) {
    if (isAborted() || error?.name === 'AbortError') {
      console.log('[SSE] Request aborted by user')
      safeComplete()
      return
    }
    console.error('[SSE] Request failed:', error)
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}
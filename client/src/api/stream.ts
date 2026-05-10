import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ReasoningStep } from './reasoning'

/**
 * SSE 流式响应回调接口
 */
export interface StreamCallbacks {
  onMessage: (content: string) => void
  onError: (error: Error) => void
  onComplete: () => void
  onConversationId?: (conversationId: string) => void
  onReasoningStep?: (step: ReasoningStep) => void
}

/**
 * SSE 流式请求参数
 */
export interface StreamRequestParams {
  url: string
  body: any
  callbacks: StreamCallbacks
}

/**
 * 处理 SSE 流式响应数据
 * @param data 原始数据字符串
 * @param callbacks 回调函数
 */
function handleSSEData(data: string, callbacks: StreamCallbacks): void {
  if (data === '[DONE]') {
    callbacks.onComplete()
    return
  }

  if (data.startsWith('[ERROR]')) {
    callbacks.onError(new Error(data.replace('[ERROR] ', '')))
    return
  }

  if (data.startsWith('[CONVERSATION_ID]')) {
    const conversationId = data.replace('[CONVERSATION_ID]', '').trim()
    if (callbacks.onConversationId && conversationId) {
      callbacks.onConversationId(conversationId)
    }
    return
  }

  // 解析 JSON 数据
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
      if (callbacks.onConversationId) {
        callbacks.onConversationId(parsed.conversationId)
      }
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
      callbacks.onComplete()
    } else if (parsed.finish_reason) {
      console.log('[SSE] Finish reason:', parsed.finish_reason)
    } else {
      console.warn('[SSE] Unknown data format, skipping:', data)
    }
  } catch (e) {
    console.warn('[SSE] Failed to parse JSON, treating as plain text:', data)
    callbacks.onMessage(data)
  }
}

/**
 * 发起 SSE 流式请求
 * @param params 请求参数
 */
export async function streamRequest(params: StreamRequestParams): Promise<void> {
  const { url, body, callbacks } = params

  console.log('[SSE] Stream request URL:', url)
  console.log('[SSE] Stream request body:', body)

  try {
    await fetchEventSource(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'AI-SVC-2026-MCP-KEY-666',
      },
      body: JSON.stringify(body),
      async onopen(response) {
        console.log('[SSE] Connection opened, status:', response.status)
        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
          return
        }
        const errorText = await response.text()
        console.error('[SSE] Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      },
      onmessage(msg) {
        if (msg.data) {
          console.log('[SSE] Received data:', msg.data)
          handleSSEData(msg.data, callbacks)
        }
      },
      onerror(err) {
        console.error('[SSE] Stream error:', err)
        callbacks.onError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      },
      onclose() {
        console.log('[SSE] Connection closed')
        callbacks.onComplete()
      },
    })
  } catch (error) {
    console.error('[SSE] Request failed:', error)
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}

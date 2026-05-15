import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ReasoningStep } from './reasoning'

/**
 * 安全处理文本，修复 Unicode 字符截断问题
 * @param text 原始文本
 * @returns 修复后的文本
 */
function safeTextDecode(text: string): string {
  // 检测并修复不完整的 UTF-16 代理对
  const lastCharCode = text.charCodeAt(text.length - 1)
  if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF) {
    // 这是一个不完整的高代理项，暂时保留
    return text.slice(0, -1)
  }
  
  // 检测并修复单独的低代理项
  const secondLastCharCode = text.charCodeAt(text.length - 2)
  if (secondLastCharCode >= 0xD800 && secondLastCharCode <= 0xDBFF &&
      lastCharCode >= 0xDC00 && lastCharCode <= 0xDFFF) {
    // 完整的代理对，正常返回
    return text
  } else if (lastCharCode >= 0xDC00 && lastCharCode <= 0xDFFF) {
    // 单独的低代理项，移除
    return text.slice(0, -1)
  }
  
  return text
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

  try {
    const parsed = JSON.parse(data)
    
    if (typeof parsed === 'string' || typeof parsed === 'number') {
      callbacks.onMessage(safeTextDecode(String(parsed)))
      return
    }
    
    if (parsed.choices && parsed.choices[0]?.delta) {
      const delta = parsed.choices[0].delta
      
      if (delta.content) {
        callbacks.onMessage(safeTextDecode(delta.content))
      } else if (delta.reasoning_content) {
        callbacks.onMessage(safeTextDecode(delta.reasoning_content))
      }
    } else if (parsed.choices && parsed.choices[0]?.message?.content) {
      callbacks.onMessage(safeTextDecode(parsed.choices[0].message.content))
    } else if (parsed.message) {
      callbacks.onMessage(safeTextDecode(parsed.message))
    } else if (parsed.type === 'conversation_id' && parsed.conversationId) {
      console.log('[SSE] Received JSON conversation_id:', parsed.conversationId)
      if (callbacks.onConversationId) {
        callbacks.onConversationId(parsed.conversationId)
      }
    } else if (parsed.type === 'chunk' && parsed.content) {
      callbacks.onMessage(safeTextDecode(parsed.content))
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
    callbacks.onMessage(safeTextDecode(data))
  }
}

/**
 * 发起 SSE 流式请求
 * @param params 请求参数
 */
export async function streamRequest(params: StreamRequestParams): Promise<void> {
  const { url, body, callbacks } = params

  // 防止 onComplete 被调用多次
  const state: StreamState = { completed: false }

  // 安全的完成回调
  const safeComplete = () => {
    if (!state.completed) {
      state.completed = true
      callbacks.onComplete()
    }
  }

  try {
    await fetchEventSource(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_API_KEY || '',
      },
      body: JSON.stringify(body),
      async onopen(response) {
        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
          return
        }
        const errorText = await response.text()
        console.error('[SSE] Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      },
      onmessage(msg) {
        if (msg.data) {
          handleSSEData(msg.data, callbacks, state)
        }
      },
      onerror(err) {
        console.error('[SSE] Stream error:', err)
        callbacks.onError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      },
      onclose() {
        safeComplete()
      },
    })
  } catch (error) {
    console.error('[SSE] Request failed:', error)
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}

import { ref, onUnmounted } from 'vue'

export interface StreamMessage {
  type: 'chunk' | 'tool' | 'error' | 'done' | 'reasoning_step'
  content?: string
  skill?: string
  result?: any
  steps?: any[]
  step?: any
  reasoningMode?: string
}

export interface UseStreamChatOptions {
  onChunk?: (content: string) => void
  onTool?: (skill: string, result: any) => void
  onReasoningStep?: (step: any) => void
  onDone?: (result: { response: string; steps: any[] }) => void
  onError?: (error: Error) => void
}

export function useStreamChat() {
  const isStreaming = ref(false)
  const error = ref<Error | null>(null)
  let abortController: AbortController | null = null

  const streamChat = async (
    url: string,
    payload: Record<string, any>,
    options: UseStreamChatOptions
  ) => {
    if (isStreaming.value) {
      console.warn('[useStreamChat] Already streaming, ignoring new request')
      return
    }

    isStreaming.value = true
    error.value = null
    abortController = new AbortController()

    const { onChunk, onTool, onReasoningStep, onDone, onError } = options

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
        signal: abortController.signal,
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
          console.log('[useStreamChat] Stream completed')
          break
        }

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          if (!trimmedLine.startsWith('data: ')) {
            console.warn('[useStreamChat] Invalid SSE format, skipping:', trimmedLine.substring(0, 100))
            continue
          }

          const jsonStr = trimmedLine.substring(6)
          try {
            const data: StreamMessage = JSON.parse(jsonStr)

            switch (data.type) {
              case 'chunk':
                onChunk?.(data.content || '')
                break
              case 'tool':
                onTool?.(data.skill || '', data.result)
                break
              case 'reasoning_step':
                onReasoningStep?.(data.step)
                break
              case 'error':
                onError?.(new Error(data.content || '未知错误'))
                return
              case 'done':
                onDone?.({
                  response: data.content || '',
                  steps: data.steps || []
                })
                return
            }
          } catch (parseError) {
            console.error('[useStreamChat] Failed to parse SSE data:', parseError, 'Data:', jsonStr.substring(0, 200))
          }
        }
      }

      if (buffer.trim()) {
        console.log('[useStreamChat] Processing remaining buffer:', buffer.substring(0, 100))
      }

      onDone?.({ response: '', steps: [] })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[useStreamChat] Request aborted')
      } else {
        error.value = err as Error
        onError?.(err as Error)
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  const abort = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  onUnmounted(() => {
    abort()
  })

  return {
    isStreaming,
    error,
    streamChat,
    abort,
  }
}

export interface UseAgentStreamOptions {
  agentId: number | string
  message: string
  apiKey?: string
  token?: string
  onChunk?: (content: string) => void
  onTool?: (skill: string, result: any) => void
  onReasoningStep?: (step: any) => void
  onDone?: (result: { response: string; steps: any[] }) => void
  onError?: (error: Error) => void
}

export function useAgentStream() {
  const { isStreaming, error, streamChat, abort } = useStreamChat()

  const sendMessage = (options: UseAgentStreamOptions) => {
    const { agentId, message, apiKey, token, onChunk, onTool, onReasoningStep, onDone, onError } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers['x-api-key'] = apiKey
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return streamChat(
      '/api/agent/chat/stream',
      { agentId, message, stream: true },
      { onChunk, onTool, onReasoningStep, onDone, onError }
    )
  }

  return {
    isStreaming,
    error,
    sendMessage,
    abort,
  }
}
import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useModelStore, useAgentStore } from '@/stores'
import { aiApi } from '@/api/ai'
import { agentApi } from '@/api/agent'
import { kbApi } from '@/api/kb'
import { retrievalApi } from '@/api/retrieval'
import type { RetrievalItem } from '@/api/retrieval'
import type { KbInfo } from '@/api/kb'
import type { ReasoningStep } from '@/api/agent'

/**
 * 聊天消息类型
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content?: string
  type?: 'retrieval' | 'rag'
  results?: RetrievalItem[]
  sources?: RetrievalItem[]
  tools?: Array<{ skill: string; result: any }>
  reasoningSteps?: ReasoningStep[]
  reasoningMode?: string
}

/**
 * 聊天逻辑 Hook
 */
export function useChat() {
  const modelStore = useModelStore()
  const agentStore = useAgentStore()

  const { loadModels, enabledModels } = modelStore
  const { loadAgents, enabledAgents } = agentStore

  const chatMode = ref('mcp')
  const selectedModel = ref('')
  const selectedAgent = ref<string | null>(null)
  const selectedKb = ref('')
  const retrievalTopN = ref(5)
  const retrievalThreshold = ref(0.7)
  const chatInput = ref('')
  const chatMessages = ref<ChatMessage[]>([])
  const chatLoading = ref(false)
  const chatMessagesRef = ref<HTMLElement | null>(null)

  const enabledKbs = ref<KbInfo[]>([])

  const quickQuestions = ['今天天气怎么样？', '现在几点了？', '帮我查一下北京的情况']
  const kbQuickQuestions = ['订单如何取消？', '退款流程是什么？', '配送需要多长时间？']

  /**
   * 加载知识库列表
   */
  const loadKbs = async () => {
    try {
      const res = await kbApi.getList({ status: true })
      enabledKbs.value = res.data.data.list || []
    } catch (error) {
      console.error('加载知识库列表失败:', error)
    }
  }

  /**
   * 发送消息
   */
  const sendMessage = async () => {
    if (!chatInput.value.trim() || chatLoading.value) return

    if (chatMode.value === 'model' && !selectedModel.value) {
      ElMessage.warning('请选择一个模型')
      return
    }

    if (chatMode.value === 'agent' && !selectedAgent.value) {
      ElMessage.warning('请选择一个智能体')
      return
    }

    if ((chatMode.value === 'kb-retrieval' || chatMode.value === 'kb-rag') && !selectedKb.value) {
      ElMessage.warning('请选择一个知识库')
      return
    }

    const userMsg = chatInput.value
    chatMessages.value.push({ role: 'user', content: userMsg })
    chatInput.value = ''
    chatLoading.value = true

    try {
      if (chatMode.value === 'kb-retrieval') {
        await handleKbRetrieval(userMsg)
      } else if (chatMode.value === 'kb-rag') {
        await handleKbRag(userMsg)
      } else if (chatMode.value === 'agent') {
        await handleAgentChat(userMsg)
      } else {
        await handleModelChat(userMsg)
      }
    } catch (error: any) {
      const errorMsg = '调用失败: ' + (error.response?.data?.message || error.message)
      chatMessages.value.push({ role: 'assistant', content: errorMsg })
    }

    chatLoading.value = false
    await scrollToBottom()
  }

  /**
   * 处理知识库检索
   */
  const handleKbRetrieval = async (query: string) => {
    const res = await retrievalApi.retrieval({
      kbId: selectedKb.value,
      query,
      topN: retrievalTopN.value,
      similarityThresh: retrievalThreshold.value
    })

    const results = res.data.data.list || []
    chatMessages.value.push({
      role: 'assistant',
      type: 'retrieval',
      results
    })
  }

  /**
   * 处理 RAG 问答
   */
  const handleKbRag = async (query: string) => {
    chatMessages.value.push({ role: 'assistant', type: 'rag', content: '', sources: [] })
    const assistantMsgIndex = chatMessages.value.length - 1

    await retrievalApi.ragChatStream(
      {
        kbId: selectedKb.value,
        query,
        topN: retrievalTopN.value,
        similarityThresh: retrievalThreshold.value
      },
      (data: string) => {
        chatMessages.value[assistantMsgIndex].content += data
        scrollToBottom()
      },
      (error: any) => {
        console.error('RAG流式调用错误:', error)
        chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || '未知错误')
      },
      (sources?: RetrievalItem[]) => {
        if (sources && sources.length > 0) {
          chatMessages.value[assistantMsgIndex].sources = sources
        }
        chatLoading.value = false
      }
    )
  }

  /**
   * 处理智能体对话
   */
  const handleAgentChat = async (query: string) => {
    chatMessages.value.push({ role: 'assistant', content: '', tools: [], reasoningSteps: [] })
    const assistantMsgIndex = chatMessages.value.length - 1

    console.log('[Chat] Starting agent stream chat')
    await agentApi.streamChat(
      selectedAgent.value!,
      query,
      (content: string) => {
        console.log('[Chat] Received chunk:', content)
        if (content === '\x00') {
          chatMessages.value[assistantMsgIndex].content = ''
        } else {
          chatMessages.value[assistantMsgIndex].content += content
        }
        scrollToBottom()
      },
      (skill: string, result: any) => {
        if (!chatMessages.value[assistantMsgIndex].tools) {
          chatMessages.value[assistantMsgIndex].tools = []
        }
        chatMessages.value[assistantMsgIndex].tools!.push({ skill, result })
        scrollToBottom()
      },
      (step: ReasoningStep) => {
        if (!chatMessages.value[assistantMsgIndex].reasoningSteps) {
          chatMessages.value[assistantMsgIndex].reasoningSteps = []
        }
        chatMessages.value[assistantMsgIndex].reasoningSteps!.push(step)
        scrollToBottom()
      },
      (error: any) => {
        console.error('智能体流式调用错误:', error)
        chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || error)
      },
      (_steps?: any[], response?: string) => {
        if (response) {
          chatMessages.value[assistantMsgIndex].content = response
        }
        chatLoading.value = false
      }
    )
  }

  /**
   * 处理模型对话
   */
  const handleModelChat = async (query: string) => {
    const payload: any = {
      modelType: 'llm',
      messages: [{ role: 'user', content: query }]
    }

    if (chatMode.value === 'model') {
      payload.modelCode = selectedModel.value
    }

    chatMessages.value.push({ role: 'assistant', content: '' })
    const assistantMsgIndex = chatMessages.value.length - 1

    await aiApi.stream(
      payload,
      (data: string) => {
        chatMessages.value[assistantMsgIndex].content += data
        scrollToBottom()
      },
      (error: any) => {
        console.error('流式调用错误:', error)
        chatMessages.value[assistantMsgIndex].content = '调用失败: ' + (error.message || '未知错误')
      },
      () => {
        chatLoading.value = false
      }
    )
  }

  /**
   * 滚动到底部
   */
  const scrollToBottom = async () => {
    await nextTick()
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  }

  /**
   * 清空消息
   */
  const clearMessages = () => {
    chatMessages.value = []
  }

  /**
   * 初始化
   */
  const init = () => {
    loadModels()
    loadAgents()
    loadKbs()
  }

  return {
    chatMode,
    selectedModel,
    selectedAgent,
    selectedKb,
    retrievalTopN,
    retrievalThreshold,
    chatInput,
    chatMessages,
    chatLoading,
    chatMessagesRef,
    enabledModels,
    enabledAgents,
    enabledKbs,
    quickQuestions,
    kbQuickQuestions,
    sendMessage,
    clearMessages,
    init
  }
}

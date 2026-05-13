import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { aiApi, agentApi, conversationApi, type Message, type Conversation } from '../api'
import type { ReasoningStep } from '../api/reasoning'

/**
 * 聊天状态管理
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const currentConversationId = ref<string | null>(null)
  const selectedType = ref<'model' | 'agent'>('model')
  const selectedModel = ref<string>('mcp')
  const selectedAgent = ref<string>('')
  const selectedLlmModel = ref<string>('mcp')
  const conversations = ref<Conversation[]>([])
  const models = ref<any[]>([])
  const agents = ref<any[]>([])
  const debugMode = ref(false)

  /**
   * 当前会话标题
   */
  const currentConversationTitle = computed(() => {
    if (!currentConversationId.value) return '新对话'
    const conv = conversations.value.find(c => c.id === currentConversationId.value)
    return conv?.title || '新对话'
  })

  /**
   * 获取当前使用的模型代码
   */
  const currentModelCode = computed(() => {
    return selectedLlmModel.value === 'mcp' ? undefined : selectedLlmModel.value
  })

  /**
   * 切换调试模式
   */
  const toggleDebugMode = () => {
    debugMode.value = !debugMode.value
  }

  /**
   * 设置选中的LLM模型
   */
  const setLlmModel = (modelCode: string) => {
    selectedLlmModel.value = modelCode
  }

  /**
   * 设置选中的智能体
   */
  const setAgent = (agentId: string) => {
    selectedAgent.value = agentId
  }

  /**
   * 发送消息
   */
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading.value) return

    const userMessage: Message = { role: 'user', content }
    messages.value.push(userMessage)
    isLoading.value = true

    const assistantMessage: Message = { 
      role: 'assistant', 
      content: '',
      reasoningSteps: []
    }
    messages.value.push(assistantMessage)

    const assistantIndex = messages.value.length - 1

    try {
      if (selectedType.value === 'model') {
        await new Promise<void>((resolve, reject) => {
          aiApi.streamChat(
            {
              modelCode: currentModelCode.value,
              messages: [userMessage],
              conversationId: currentConversationId.value,
            },
            (chunk: string) => {
              messages.value[assistantIndex].content += chunk
            },
            (error: Error) => {
              messages.value[assistantIndex].content = `错误: ${error.message}`
              reject(error)
            },
            () => {
              isLoading.value = false
              loadConversations()
              resolve()
            },
            (conversationId: string) => {
              currentConversationId.value = conversationId
            }
          )
        })
      } else {
        await new Promise<void>((resolve, reject) => {
          console.log('[Chat] Agent stream params:', {
            agentId: selectedAgent.value,
            conversationId: currentConversationId.value,
            selectedType: selectedType.value,
            modelCode: currentModelCode.value,
          })
          agentApi.streamChat(
            {
              agentId: selectedAgent.value,
              message: content,
              conversationId: currentConversationId.value,
              modelCode: currentModelCode.value,
              showReasoning: debugMode.value,
            },
            (chunk: string) => {
              messages.value[assistantIndex].content += chunk
            },
            (error: Error) => {
              messages.value[assistantIndex].content = `错误: ${error.message}`
              reject(error)
            },
            () => {
              isLoading.value = false
              loadConversations()
              resolve()
            },
            (conversationId: string) => {
              console.log('[Chat] Agent received conversationId:', conversationId)
              currentConversationId.value = conversationId
            },
            (step: ReasoningStep) => {
              if (debugMode.value && messages.value[assistantIndex].reasoningSteps) {
                messages.value[assistantIndex].reasoningSteps!.push(step)
              }
            }
          )
        })
      }
    } catch (error) {
      isLoading.value = false
    }
  }

  /**
   * 清空消息
   */
  const clearMessages = () => {
    console.log('[Chat] Clearing messages, prev conversationId:', currentConversationId.value)
    messages.value = []
    currentConversationId.value = null
  }

  /**
   * 新建会话
   */
  const newConversation = () => {
    clearMessages()
  }

  /**
   * 切换会话
   */
  const switchConversation = async (conversationId: string) => {
    try {
      const response = await conversationApi.getDetail(conversationId)
      currentConversationId.value = conversationId
      
      const rawMessages = response.data.messages || []
      rawMessages.forEach((msg: Message, index: number) => {
        if (msg.role === 'assistant' && msg.content.includes('```')) {
          const codeBlockMatch = msg.content.match(/```(\w*)\n?/)
          if (codeBlockMatch) {
            console.log(`[历史消息${index}] 代码块格式:`, JSON.stringify(codeBlockMatch[0]))
            console.log(`[历史消息${index}] 代码块后10字符:`, msg.content.substring(codeBlockMatch.index! + codeBlockMatch[0].length, codeBlockMatch.index! + codeBlockMatch[0].length + 10))
          }
        }
      })
      
      messages.value = rawMessages
    } catch (error) {
      console.error('加载会话失败:', error)
    }
  }

  /**
   * 加载会话列表
   */
  const loadConversations = async () => {
    try {
      const params: any = {
        conversationType: selectedType.value,
        pageSize: 20,
      }

      if (selectedType.value === 'model') {
        if (selectedModel.value && selectedModel.value !== 'mcp') {
          params.targetId = String(selectedModel.value)
        }
      } else if (selectedType.value === 'agent') {
        if (selectedAgent.value) {
          params.targetId = String(selectedAgent.value)
        }
      }

      const response = await conversationApi.getList(params)
      conversations.value = response.data.list || []
    } catch (error) {
      console.error('加载会话列表失败:', error)
    }
  }

  /**
   * 删除会话
   */
  const deleteConversation = async (conversationId: string) => {
    try {
      await conversationApi.delete(conversationId)
      await loadConversations()
      if (currentConversationId.value === conversationId) {
        clearMessages()
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  /**
   * 加载模型列表
   */
  const loadModels = async () => {
    try {
      const response = await aiApi.getModels()
      models.value = response.data || []
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }
  }

  /**
   * 加载智能体列表
   */
  const loadAgents = async () => {
    try {
      const response = await agentApi.getList()
      agents.value = response.data || []
    } catch (error) {
      console.error('加载智能体列表失败:', error)
    }
  }

  return {
    messages,
    isLoading,
    currentConversationId,
    currentConversationTitle,
    selectedType,
    selectedModel,
    selectedAgent,
    selectedLlmModel,
    currentModelCode,
    conversations,
    models,
    agents,
    debugMode,
    sendMessage,
    clearMessages,
    newConversation,
    switchConversation,
    loadConversations,
    deleteConversation,
    loadModels,
    loadAgents,
    toggleDebugMode,
    setLlmModel,
    setAgent,
  }
})

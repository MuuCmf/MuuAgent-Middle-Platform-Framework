import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message } from '../api/ai'
import type { Conversation } from '../services/ConversationService'

/**
 * 聊天状态管理（精简版）
 * 仅保留状态定义，业务逻辑已迁移到 ChatController
 * 保留此文件以兼容现有代码引用
 */
export const useChatStore = defineStore('chat', () => {
  /** 消息列表 */
  const messages = ref<Message[]>([])
  /** 加载状态 */
  const isLoading = ref(false)
  /** 当前会话ID */
  const currentConversationId = ref<string | null>(null)
  /** 选中的类型 */
  const selectedType = ref<'model' | 'agent'>('model')
  /** 选中的模型 */
  const selectedModel = ref<string>('mcp-llm')
  /** 选中的智能体 */
  const selectedAgent = ref<string>('')
  /** 选中的LLM模型 */
  const selectedLlmModel = ref<string>('mcp-llm')
  /** 会话列表 */
  const conversations = ref<Conversation[]>([])
  /** 模型列表 */
  const models = ref<any[]>([])
  /** 智能体列表 */
  const agents = ref<any[]>([])
  /** 调试模式 */
  const debugMode = ref(false)
  /** 思考模式 */
  const enableThinkingMode = ref(false)
  /** 工作目录名称 */
  const workspaceDirName = ref<string | null>(null)
  /** 工作目录是否激活 */
  const workspaceIsActive = ref(false)

  /**
   * 当前会话标题
   */
  const currentConversationTitle = computed(() => {
    if (!currentConversationId.value) return '新对话'
    const conv = conversations.value.find((c) => c.id === currentConversationId.value)
    return conv?.title || '新对话'
  })

  /**
   * 获取当前使用的模型代码
   */
  const currentModelCode = computed(() => {
    return selectedLlmModel.value === 'mcp-llm' ? undefined : selectedLlmModel.value
  })

  /**
   * 清空消息
   */
  const clearMessages = () => {
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
   * 设置选中的LLM模型
   * @param modelCode 模型代码
   */
  const setLlmModel = (modelCode: string) => {
    selectedLlmModel.value = modelCode
  }

  /**
   * 设置选中的智能体
   * @param agentId 智能体ID
   */
  const setAgent = (agentId: string) => {
    selectedAgent.value = agentId
  }

  /**
   * 停止生成（占位方法，实际逻辑在 ChatController）
   */
  const stopGeneration = () => {
    isLoading.value = false
  }

  /**
   * 删除会话（占位方法，实际逻辑在 ChatController）
   * @param _conversationId 会话ID
   */
  const deleteConversation = async (_conversationId: string) => {
  }

  /**
   * 加载会话列表（占位方法，实际逻辑在 ChatController）
   */
  const loadConversations = async () => {
  }

  /**
   * 加载模型列表（占位方法，实际逻辑在 ChatController）
   */
  const loadModels = async () => {
  }

  /**
   * 加载智能体列表（占位方法，实际逻辑在 ChatController）
   */
  const loadAgents = async () => {
  }

  /**
   * 发送消息（占位方法，实际逻辑在 ChatController）
   * @param _content 消息内容
   */
  const sendMessage = async (_content: string) => {
  }

  /**
   * 选择工作目录（占位方法，实际逻辑在 useWorkspace）
   */
  const workspaceSelectDirectory = async () => {
  }

  /**
   * 清除工作目录（占位方法，实际逻辑在 useWorkspace）
   */
  const workspaceClear = () => {
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
    enableThinkingMode,
    workspaceDirName,
    workspaceIsActive,
    sendMessage,
    stopGeneration,
    clearMessages,
    newConversation,
    deleteConversation,
    loadConversations,
    loadModels,
    loadAgents,
    setLlmModel,
    setAgent,
    workspaceSelectDirectory,
    workspaceClear,
  }
})

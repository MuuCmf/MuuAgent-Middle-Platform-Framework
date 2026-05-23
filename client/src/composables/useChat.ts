import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { chatController } from '../controllers/ChatController'
import { ragController } from '../controllers/RagController'
import { conversationService } from '../services/ConversationService'

/**
 * 聊天模式类型
 */
export type ChatMode = 'chat' | 'rag' | 'retrieval'

/**
 * 聊天组合式函数
 * 整合聊天控制器和RAG控制器的逻辑，提供统一的视图层接口
 */
export function useChat() {
  /** 当前聊天模式 */
  const chatMode = ref<ChatMode>('chat')

  /** 消息列表引用 */
  const messagesRef = ref<HTMLElement>()

  /** 当前选中的智能体（视图层状态） */
  const selectedAgent = ref<string>('')

  /** 当前选中的LLM模型（视图层状态） */
  const selectedLlmModel = ref<string>('mcp-llm')

  /**
   * 当前消息列表
   */
  const messages = computed(() => {
    if (chatMode.value === 'chat') {
      return chatController.messages.value
    }
    return ragController.messages.value
  })

  /**
   * 加载状态
   */
  const isLoading = computed(() => {
    if (chatMode.value === 'chat') {
      return chatController.isLoading.value
    }
    return ragController.isLoading.value
  })

  /**
   * 当前会话ID
   */
  const currentConversationId = computed(() => {
    if (chatMode.value === 'chat') {
      return chatController.currentConversationId.value
    }
    return ragController.currentConversationId.value
  })

  /**
   * 当前会话标题
   */
  const currentConversationTitle = computed(() => {
    if (chatMode.value === 'chat') {
      return chatController.currentConversationTitle.value
    }
    return 'RAG问答'
  })

  /**
   * 会话列表
   */
  const conversations = computed(() => {
    if (chatMode.value === 'chat') {
      return chatController.conversations.value
    }
    return ragController.conversations.value
  })

  /**
   * 模型列表
   */
  const models = computed(() => chatController.models.value)

  /**
   * 智能体列表
   */
  const agents = computed(() => chatController.agents.value)

  /**
   * 启用的智能体列表
   */
  const enabledAgents = computed(() => chatController.enabledAgents.value)

  /**
   * 工具权限策略
   */
  const toolPolicies = computed(() => chatController.toolPolicies.value)

  /**
   * 调试模式
   */
  const debugMode = computed(() => chatController.debugMode.value)

  /**
   * 思考模式
   */
  const enableThinkingMode = computed(() => chatController.enableThinkingMode.value)

  /**
   * 工作目录状态
   */
  const workspaceIsActive = computed(() => chatController.workspace.isActive.value)
  const workspaceDirName = computed(() => chatController.workspace.dirName.value)

  /**
   * 滚动到底部
   */
  const scrollToBottom = async () => {
    await nextTick()
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  }

  /**
   * 判断消息是否正在流式输出
   * @param index 消息索引
   * @returns 是否正在流式输出
   */
  const isMessageStreaming = (index: number): boolean => {
    const msgs = messages.value
    if (!isLoading.value) return false
    if (index !== msgs.length - 1) return false
    return msgs[index].role === 'assistant'
  }

  /**
   * 处理模式切换
   * @param mode 目标模式
   */
  const handleModeChange = async (mode: ChatMode) => {
    chatMode.value = mode
    chatController.clearMessages()
    ragController.clearMessages()
    chatController.currentConversationId.value = null
    chatController.conversations.value = []

    if (mode !== 'chat' && ragController.kbList.value.length === 0) {
      await ragController.loadKbList()
    }

    if (mode === 'rag') {
      await ragController.loadRagConversations()
    } else if (mode === 'chat') {
      await chatController.loadConversations()
    }
  }

  /**
   * 处理LLM模型变更
   * @param modelCode 模型代码
   */
  const handleLlmModelChange = (modelCode: string) => {
    selectedLlmModel.value = modelCode
    chatController.setLlmModel(modelCode)
  }

  /**
   * 处理智能体变更
   * @param agentId 智能体ID
   */
  const handleAgentChange = async (agentId: string) => {
    selectedAgent.value = agentId
    chatController.setAgent(agentId)
    chatController.clearMessages()
    chatController.currentConversationId.value = null
    chatController.selectedType.value = agentId ? 'agent' : 'model'
    await chatController.loadConversations()
  }

  /**
   * 处理知识库变更
   */
  const handleKbChange = async () => {
    ragController.clearMessages()
    if (chatMode.value === 'rag') {
      await ragController.loadRagConversations()
    }
  }

  /**
   * 发送消息（统一入口）
   * @param content 消息内容
   */
  const handleSendMessage = async (content: string) => {
    if (chatMode.value === 'chat') {
      chatController.selectedType.value = selectedAgent.value ? 'agent' : 'model'
      chatController.selectedAgent.value = selectedAgent.value
      chatController.selectedLlmModel.value = selectedLlmModel.value
      await chatController.sendMessage(content)
    } else if (chatMode.value === 'rag') {
      await ragController.ragChat(content, selectedLlmModel.value)
    } else if (chatMode.value === 'retrieval') {
      await ragController.retrieval(content)
    }
    scrollToBottom()
  }

  /**
   * 选择会话
   * @param conversationId 会话ID
   */
  const handleSelectConversation = async (conversationId: string) => {
    try {
      const response = await conversationService.getDetail(conversationId)
      const conversation = response.data.conversation
      const rawMessages = response.data.messages || []

      if (conversation.conversationType === 'kb-rag') {
        chatMode.value = 'rag'
        ragController.currentConversationId.value = conversation.id
        ragController.messages.value = rawMessages
        ragController.selectedKb.value = conversation.targetId
        if (ragController.kbList.value.length === 0) {
          await ragController.loadKbList()
        }
      } else if (conversation.conversationType === 'agent') {
        chatMode.value = 'chat'
        chatController.currentConversationId.value = conversation.id
        chatController.messages.value = rawMessages
        chatController.selectedType.value = 'agent'
        selectedAgent.value = conversation.targetId || ''
        chatController.selectedAgent.value = selectedAgent.value
      } else {
        chatMode.value = 'chat'
        chatController.currentConversationId.value = conversation.id
        chatController.messages.value = rawMessages
        chatController.selectedType.value = 'model'
        selectedAgent.value = ''
        chatController.selectedAgent.value = ''
        if (conversation.targetId) {
          selectedLlmModel.value = conversation.targetId
          chatController.selectedLlmModel.value = conversation.targetId
        }
      }

      scrollToBottom()
    } catch (error) {
      console.error('加载会话失败:', error)
    }
  }

  /**
   * 删除会话
   * @param conversationId 会话ID
   */
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      if (chatMode.value === 'rag') {
        await conversationService.delete(conversationId)
        await ragController.loadRagConversations()
        if (ragController.currentConversationId.value === conversationId) {
          ragController.clearMessages()
        }
      } else {
        await chatController.deleteConversation(conversationId)
      }
      ElMessage.success('会话已删除')
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }

  /**
   * 新建会话
   */
  const handleNewConversation = () => {
    if (chatMode.value === 'chat') {
      chatController.newConversation()
    } else {
      ragController.clearMessages()
    }
  }

  /**
   * 停止生成
   */
  const handleStopGeneration = () => {
    chatController.stopGeneration()
  }

  /**
   * 处理调试模式变更
   * @param value 是否启用
   */
  const handleDebugModeChange = (value: boolean) => {
    chatController.debugMode.value = value
    ElMessage.success(value ? '已开启调试模式，将显示推理过程' : '已关闭调试模式')
  }

  /**
   * 处理思考模式变更
   * @param value 是否启用
   */
  const handleThinkingModeChange = (value: boolean) => {
    chatController.enableThinkingMode.value = value
    ElMessage.success(value ? '已开启思考模式，模型将输出思考过程' : '已关闭思考模式')
  }

  /**
   * 处理工作目录选择
   */
  const handleWorkspaceSelect = async () => {
    try {
      await chatController.workspace.selectDirectory()
      ElMessage.success(`已选择工作目录: ${chatController.workspace.dirName.value}`)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      ElMessage.error('选择工作目录失败: ' + (e.message || '未知错误'))
    }
  }

  /**
   * 处理工作目录清除
   */
  const handleWorkspaceClear = () => {
    chatController.workspace.clear()
    ElMessage.success('已清除工作目录')
  }

  /**
   * 获取模型名称
   * @param modelCode 模型代码
   * @returns 模型名称
   */
  const getModelName = (modelCode: string): string => {
    const model = chatController.models.value.find((m: any) => m.code === modelCode)
    return model?.name || modelCode
  }

  /**
   * 获取智能体名称
   * @param agentId 智能体ID
   * @returns 智能体名称
   */
  const getAgentName = (agentId: string): string => {
    const agent = chatController.agents.value.find((a: any) => a.id === agentId)
    return agent?.name || agentId
  }

  /**
   * 获取空状态标题
   * @returns 标题文本
   */
  const getEmptyTitle = (): string => {
    switch (chatMode.value) {
      case 'chat':
        return '开始新的对话'
      case 'rag':
        return '开始RAG问答'
      case 'retrieval':
        return '开始向量检索'
      default:
        return '开始新的对话'
    }
  }

  /**
   * 获取空状态描述
   * @returns 描述文本
   */
  const getEmptyDescription = (): string => {
    switch (chatMode.value) {
      case 'chat':
        return '输入消息开始与AI助手对话'
      case 'rag':
        return '选择知识库后输入问题，基于文档内容进行问答'
      case 'retrieval':
        return '选择知识库后输入关键词进行向量检索'
      default:
        return '输入消息开始与AI助手对话'
    }
  }

  /**
   * 初始化
   */
  const init = async () => {
    await chatController.init()
  }

  watch(
    () => messages.value.length,
    () => {
      scrollToBottom()
    },
  )

  return {
    chatMode,
    messagesRef,
    selectedAgent,
    selectedLlmModel,
    messages,
    isLoading,
    currentConversationId,
    currentConversationTitle,
    conversations,
    models,
    agents,
    enabledAgents,
    toolPolicies,
    debugMode,
    enableThinkingMode,
    workspaceIsActive,
    workspaceDirName,
    isMessageStreaming,
    scrollToBottom,
    handleModeChange,
    handleLlmModelChange,
    handleAgentChange,
    handleKbChange,
    handleSendMessage,
    handleSelectConversation,
    handleDeleteConversation,
    handleNewConversation,
    handleStopGeneration,
    handleDebugModeChange,
    handleThinkingModeChange,
    handleWorkspaceSelect,
    handleWorkspaceClear,
    getModelName,
    getAgentName,
    getEmptyTitle,
    getEmptyDescription,
    init,
  }
}

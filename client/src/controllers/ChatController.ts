import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { chatService, type StreamChatCallbacks } from '../services/ChatService'
import { agentService, type AgentStreamChatCallbacks } from '../services/AgentService'
import { conversationService, type Conversation } from '../services/ConversationService'
import { clientToolService } from '../services/ClientToolService'
import { useWorkspace } from '../composables/useWorkspace'
import { WorkspaceExecutor } from '../executor/workspace.executor'
import { dynamicClientToolExecutor } from '../executor/dynamic-client-tool.executor'
import { clientToolRouter } from '../executor/client-tool-router'
import type { Message } from '../api/ai'
import type { ReasoningStep } from '../api/reasoning'
import type { ClientToolCallPayload } from '../api/stream'
import type { ClientToolModulePolicy } from '../executor/types'

/**
 * 处理思考内容和回答内容的分割
 * @param msg 消息对象
 * @param chunk 新接收的内容片段
 */
const processThinkingContent = (msg: Message, chunk: string) => {
  msg.content += chunk

  const thinkingIndex = msg.content.indexOf('[THINKING]')
  const thinkingIndexZh = msg.content.indexOf('[思考]')
  const answerIndex = msg.content.indexOf('[ANSWER]')
  const answerIndexZh = msg.content.indexOf('[回答]')

  const thinkingPos = thinkingIndex !== -1 ? thinkingIndex : thinkingIndexZh
  const answerPos = answerIndex !== -1 ? answerIndex : answerIndexZh
  const thinkingTagLen = thinkingIndex !== -1 ? 10 : 8
  const answerTagLen = answerIndex !== -1 ? 8 : 6

  if (thinkingPos !== -1 && answerPos !== -1 && answerPos > thinkingPos) {
    const thinkingContent = msg.content.substring(thinkingPos + thinkingTagLen, answerPos).trim()
    const answerContent = msg.content.substring(answerPos + answerTagLen).trim()
    const beforeThinking = msg.content.substring(0, thinkingPos).trim()

    msg.thinkingContent = thinkingContent
    msg.content = beforeThinking + (beforeThinking && answerContent ? '\n\n' : '') + answerContent
  }
}

/**
 * 思考模式系统提示词
 */
const THINKING_SYSTEM_PROMPT = `请按照以下格式回答问题：
[THINKING]
你的思考过程和分析
[ANSWER]
正式回答内容

注意：
1. [THINKING] 部分写出你的思考过程
2. [ANSWER] 部分给出正式回答
3. 必须严格按照这个格式输出`

/**
 * 聊天控制器
 * 封装聊天相关的业务逻辑编排
 * 从 store 中分离出控制器层，负责业务流程的协调
 */
export class ChatController {
  /** 消息列表 */
  messages = ref<Message[]>([])

  /** 加载状态 */
  isLoading = ref(false)

  /** 当前会话ID */
  currentConversationId = ref<string | null>(null)

  /** 选中的类型 */
  selectedType = ref<'model' | 'agent'>('model')

  /** 选中的模型 */
  selectedModel = ref<string>('mcp-llm')

  /** 选中的智能体 */
  selectedAgent = ref<string>('')

  /** 选中的LLM模型 */
  selectedLlmModel = ref<string>('mcp-llm')

  /** 会话列表 */
  conversations = ref<Conversation[]>([])

  /** 模型列表 */
  models = ref<any[]>([])

  /** 智能体列表 */
  agents = ref<any[]>([])

  /** 调试模式 */
  debugMode = ref(false)

  /** 思考模式 */
  enableThinkingMode = ref(false)

  /** 当前流式请求的 AbortController */
  abortController = ref<AbortController | null>(null)

  /** 工作目录 */
  workspace = useWorkspace()

  /**
   * 当前会话标题
   */
  currentConversationTitle = computed(() => {
    if (!this.currentConversationId.value) return '新对话'
    const conv = this.conversations.value.find((c) => c.id === this.currentConversationId.value)
    return conv?.title || '新对话'
  })

  /**
   * 获取当前使用的模型代码
   */
  currentModelCode = computed(() => {
    return this.selectedLlmModel.value === 'mcp-llm' ? undefined : this.selectedLlmModel.value
  })

  /**
   * 启用的智能体列表
   */
  enabledAgents = computed(() => {
    return this.agents.value.filter((a: any) => a.status === true)
  })

  /**
   * 客户端工具权限策略
   */
  toolPolicies = computed(() => {
    return clientToolRouter.getAllPolicies()
  })

  /**
   * 发送消息（统一入口）
   * @param content 消息内容
   */
  async sendMessage(content: string): Promise<void> {
    if (!content.trim() || this.isLoading.value) return

    await clientToolService.syncToRegistry()

    if (this.workspace.dirHandle.value) {
      clientToolRouter.registerExecutor(new WorkspaceExecutor(this.workspace.dirHandle.value))
    }
    clientToolRouter.registerExecutor(dynamicClientToolExecutor)

    const userMessage: Message = { role: 'user', content, timestamp: Date.now() }
    this.messages.value.push(userMessage)
    this.isLoading.value = true

    const controller = new AbortController()
    this.abortController.value = controller

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      reasoningSteps: [],
      timestamp: Date.now(),
    }
    this.messages.value.push(assistantMessage)
    const assistantIndex = this.messages.value.length - 1

    try {
      if (this.selectedType.value === 'model') {
        await this.streamModelChat(assistantIndex, userMessage, controller.signal)
      } else {
        await this.streamAgentChat(content, assistantIndex, controller.signal)
      }
    } catch (error) {
      this.isLoading.value = false
      this.abortController.value = null
    }
  }

  /**
   * 模型流式聊天
   * @param assistantIndex 助手消息索引
   * @param userMessage 用户消息
   * @param signal 取消信号
   */
  private async streamModelChat(
    assistantIndex: number,
    userMessage: Message,
    signal: AbortSignal,
  ): Promise<void> {
    const messagesToSend: Message[] = []

    if (this.enableThinkingMode.value) {
      messagesToSend.push({
        role: 'system',
        content: THINKING_SYSTEM_PROMPT,
      })
    }

    messagesToSend.push(userMessage)

    await new Promise<void>((resolve, reject) => {
      chatService.streamChat(
        {
          modelCode: this.currentModelCode.value,
          messages: messagesToSend,
          conversationId: this.currentConversationId.value,
        },
        {
          onMessage: (chunk: string) => {
            processThinkingContent(this.messages.value[assistantIndex], chunk)
          },
          onError: (error: Error) => {
            this.messages.value[assistantIndex].content = `错误: ${error.message}`
            reject(error)
          },
          onComplete: () => {
            this.isLoading.value = false
            this.abortController.value = null
            this.loadConversations()
            resolve()
          },
          onConversationId: (conversationId: string) => {
            this.currentConversationId.value = conversationId
          },
        },
        signal,
      )
    })
  }

  /**
   * 智能体流式聊天
   * @param content 消息内容
   * @param assistantIndex 助手消息索引
   * @param signal 取消信号
   */
  private async streamAgentChat(
    content: string,
    assistantIndex: number,
    signal: AbortSignal,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      agentService.streamChat(
        {
          agentId: this.selectedAgent.value,
          message: content,
          conversationId: this.currentConversationId.value,
          modelCode: this.currentModelCode.value,
          showReasoning: this.debugMode.value,
          workspace: this.workspace.isActive.value
            ? {
                dirName: this.workspace.dirName.value!,
                treeSummary: this.workspace.treeSummary.value!,
              }
            : undefined,
        },
        {
          onMessage: (chunk: string) => {
            processThinkingContent(this.messages.value[assistantIndex], chunk)
          },
          onError: (error: Error) => {
            this.messages.value[assistantIndex].content = `错误: ${error.message}`
            reject(error)
          },
          onComplete: () => {
            this.isLoading.value = false
            this.abortController.value = null
            this.loadConversations()
            resolve()
          },
          onConversationId: (conversationId: string) => {
            this.currentConversationId.value = conversationId
          },
          onReasoningStep: (step: ReasoningStep) => {
            if (this.debugMode.value && this.messages.value[assistantIndex].reasoningSteps) {
              this.messages.value[assistantIndex].reasoningSteps!.push(step)
            }
          },
          onClientToolCall: (payload: ClientToolCallPayload) => {
            clientToolRouter.handleCall(
              payload,
              (message) => {
                return ElMessageBox.confirm(message, '操作确认', {
                  confirmButtonText: '确定',
                  cancelButtonText: '取消',
                  type: 'warning',
                })
                  .then(() => true)
                  .catch(() => false)
              },
              this.currentConversationId.value,
            )
          },
          onClientToolPolicy: (policies: ClientToolModulePolicy[]) => {
            clientToolRouter.updatePolicies(policies)
          },
        },
        signal,
      )
    })
  }

  /**
   * 停止当前生成
   */
  stopGeneration(): void {
    if (this.abortController.value) {
      this.abortController.value.abort()
      this.abortController.value = null
      this.isLoading.value = false
    }
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    this.messages.value = []
    this.currentConversationId.value = null
  }

  /**
   * 新建会话
   */
  newConversation(): void {
    this.clearMessages()
  }

  /**
   * 加载会话列表
   */
  async loadConversations(): Promise<void> {
    try {
      const params: any = {
        conversationType: this.selectedType.value,
        pageSize: 20,
      }

      if (this.selectedType.value === 'model') {
        if (this.selectedModel.value && this.selectedModel.value !== 'mcp-llm') {
          params.targetId = String(this.selectedModel.value)
        }
      } else if (this.selectedType.value === 'agent') {
        if (this.selectedAgent.value) {
          params.targetId = String(this.selectedAgent.value)
        }
      }

      const response = await conversationService.getList(params)
      this.conversations.value = response.data.list || []
    } catch (error) {
      console.error('加载会话列表失败:', error)
    }
  }

  /**
   * 加载RAG会话列表
   * @param kbId 知识库ID
   */
  async loadRagConversations(kbId?: string): Promise<void> {
    try {
      const params: any = {
        conversationType: 'kb-rag',
        pageSize: 20,
      }
      if (kbId) {
        params.targetId = kbId
      }
      const response = await conversationService.getList(params)
      this.conversations.value = response.data.list || []
    } catch (error) {
      console.error('加载RAG会话列表失败:', error)
    }
  }

  /**
   * 切换会话
   * @param conversationId 会话ID
   */
  async switchConversation(conversationId: string): Promise<void> {
    try {
      const response = await conversationService.getDetail(conversationId)
      this.currentConversationId.value = conversationId
      this.messages.value = response.data.messages || []
    } catch (error) {
      console.error('加载会话失败:', error)
    }
  }

  /**
   * 删除会话
   * @param conversationId 会话ID
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await conversationService.delete(conversationId)
      await this.loadConversations()
      if (this.currentConversationId.value === conversationId) {
        this.clearMessages()
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  /**
   * 加载模型列表
   */
  async loadModels(): Promise<void> {
    try {
      const response = await chatService.getModels()
      this.models.value = response.data || []
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }
  }

  /**
   * 加载智能体列表
   */
  async loadAgents(): Promise<void> {
    try {
      const response = await agentService.getList()
      this.agents.value = response.data || []
    } catch (error) {
      console.error('加载智能体列表失败:', error)
    }
  }

  /**
   * 设置选中的LLM模型
   * @param modelCode 模型代码
   */
  setLlmModel(modelCode: string): void {
    this.selectedLlmModel.value = modelCode
  }

  /**
   * 设置选中的智能体
   * @param agentId 智能体ID
   */
  setAgent(agentId: string): void {
    this.selectedAgent.value = agentId
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await this.loadModels()
    await this.loadAgents()
    await this.loadConversations()
  }
}

/** 全局聊天控制器实例 */
export const chatController = new ChatController()

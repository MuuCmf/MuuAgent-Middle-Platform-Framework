import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { aiApi, agentApi, conversationApi, type Message, type Conversation } from '../api'
import type { ReasoningStep } from '../api/reasoning'
import type { ClientToolCallPayload } from '../api/stream'
import type { ClientToolModulePolicy } from '../executor/types'
import { useWorkspace } from '../composables/useWorkspace'
import { WorkspaceExecutor } from '../executor/workspace.executor'
import { systemControlExecutor } from '../executor/system-control.executor'
import { dynamicClientToolExecutor } from '../executor/dynamic-client-tool.executor'
import { dynamicPluginRegistry } from '../executor/dynamic-plugin-registry'
import { syncDynamicClientTools } from '../api/client-tool'
import { clientToolRouter } from '../executor/client-tool-router'

/**
 * 处理思考内容和回答内容的分割
 * @param msg 消息对象
 * @param chunk 新接收的内容片段
 */
const processThinkingContent = (msg: Message, chunk: string) => {
  // 追加内容
  msg.content += chunk
  
  // 检测 [THINKING] 和 [ANSWER] 标记
  const thinkingIndex = msg.content.indexOf('[THINKING]')
  const thinkingIndexZh = msg.content.indexOf('[思考]')
  const answerIndex = msg.content.indexOf('[ANSWER]')
  const answerIndexZh = msg.content.indexOf('[回答]')
  
  const thinkingPos = thinkingIndex !== -1 ? thinkingIndex : thinkingIndexZh
  const answerPos = answerIndex !== -1 ? answerIndex : answerIndexZh
  const thinkingTagLen = thinkingIndex !== -1 ? 10 : 8  // [THINKING] 或 [思考]
  const answerTagLen = answerIndex !== -1 ? 8 : 6  // [ANSWER] 或 [回答]
  
  // 如果检测到了标记，进行分割
  if (thinkingPos !== -1 && answerPos !== -1 && answerPos > thinkingPos) {
    // 提取思考内容：[THINKING] 和 [ANSWER] 之间的内容
    const thinkingContent = msg.content
      .substring(thinkingPos + thinkingTagLen, answerPos)
      .trim()
    
    // 提取回答内容：[ANSWER] 之后的内容
    const answerContent = msg.content
      .substring(answerPos + answerTagLen)
      .trim()
    
    // 提取 [THINKING] 之前的内容（如果有）
    const beforeThinking = msg.content
      .substring(0, thinkingPos)
      .trim()
    
    // 更新消息
    msg.thinkingContent = thinkingContent
    msg.content = beforeThinking + (beforeThinking && answerContent ? '\n\n' : '') + answerContent
  }
}

/**
 * 聊天状态管理
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const currentConversationId = ref<string | null>(null)
  const selectedType = ref<'model' | 'agent'>('model')
  const selectedModel = ref<string>('mcp-llm')
  const selectedAgent = ref<string>('')
  const selectedLlmModel = ref<string>('mcp-llm')
  const conversations = ref<Conversation[]>([])
  const models = ref<any[]>([])
  const agents = ref<any[]>([])
  const debugMode = ref(false)
  const enableThinkingMode = ref(false)

  /** 当前流式请求的 AbortController，用于取消对话 */
  const abortController = ref<AbortController | null>(null)

  // 工作目录状态
  const workspace = useWorkspace()

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
    return selectedLlmModel.value === 'mcp-llm' ? undefined : selectedLlmModel.value
  })

  /**
   * 切换调试模式
   */
  const toggleDebugMode = () => {
    debugMode.value = !debugMode.value
  }

  /**
   * 切换思考模式
   */
  const toggleThinkingMode = () => {
    enableThinkingMode.value = !enableThinkingMode.value
  }

  /**
   * 设置思考模式
   * @param enabled 是否启用
   */
  const setThinkingMode = (enabled: boolean) => {
    enableThinkingMode.value = enabled
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

    /** 同步动态客户端工具定义到插件注册表 */
    try {
      const definitions = await syncDynamicClientTools()
      dynamicPluginRegistry.sync(definitions.map(d => ({
        name: d.name,
        displayName: d.displayName || undefined,
        description: d.description,
        parameters: d.parameters,
        executorType: d.executorType as 'http_request' | 'script' | 'command',
        executorConfig: d.executorConfig,
        confirmMode: d.confirmMode as 'auto' | 'confirm' | 'deny',
        confirmMessage: d.confirmMessage || undefined,
        timeout: d.timeout,
      })))
    } catch (e) {
      console.warn('[Chat] 同步动态工具定义失败:', e)
    }

    /** 注册客户端工具执行器到路由器 */
    if (workspace.dirHandle.value) {
      clientToolRouter.registerExecutor(new WorkspaceExecutor(workspace.dirHandle.value))
    }
    clientToolRouter.registerExecutor(systemControlExecutor)
    clientToolRouter.registerExecutor(dynamicClientToolExecutor)

    const userMessage: Message = { role: 'user', content }
    messages.value.push(userMessage)
    isLoading.value = true

    /** 创建新的 AbortController 用于取消当前请求 */
    const controller = new AbortController()
    abortController.value = controller

    const assistantMessage: Message = { 
      role: 'assistant', 
      content: '',
      reasoningSteps: []
    }
    messages.value.push(assistantMessage)

    const assistantIndex = messages.value.length - 1

    try {
      if (selectedType.value === 'model') {
        const messagesToSend: Message[] = []
        
        if (enableThinkingMode.value) {
          messagesToSend.push({
            role: 'system',
            content: THINKING_SYSTEM_PROMPT
          })
        }
        
        messagesToSend.push(userMessage)
        
        await new Promise<void>((resolve, reject) => {
          aiApi.streamChat(
            {
              modelCode: currentModelCode.value,
              messages: messagesToSend,
              conversationId: currentConversationId.value,
            },
            (chunk: string) => {
              processThinkingContent(messages.value[assistantIndex], chunk)
            },
            (error: Error) => {
              messages.value[assistantIndex].content = `错误: ${error.message}`
              reject(error)
            },
            () => {
              isLoading.value = false
              abortController.value = null
              loadConversations()
              resolve()
            },
            (conversationId: string) => {
              currentConversationId.value = conversationId
            },
            controller.signal,
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
              workspace: workspace.isActive.value ? {
                dirName: workspace.dirName.value!,
                treeSummary: workspace.treeSummary.value!,
              } : undefined,
            },
            (chunk: string) => {
              processThinkingContent(messages.value[assistantIndex], chunk)
            },
            (error: Error) => {
              messages.value[assistantIndex].content = `错误: ${error.message}`
              reject(error)
            },
            () => {
              isLoading.value = false
              abortController.value = null
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
            },
            (payload: ClientToolCallPayload) => {
              clientToolRouter.handleCall(
                payload,
                (message) => {
                  return ElMessageBox.confirm(message, '操作确认', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning',
                  }).then(() => true).catch(() => false)
                },
                currentConversationId.value,
              )
            },
            (policies: ClientToolModulePolicy[]) => {
              clientToolRouter.updatePolicies(policies)
            },
            controller.signal,
          )
        })
      }
    } catch (error) {
      isLoading.value = false
      abortController.value = null
    }
  }

  /**
   * 停止当前生成
   */
  const stopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
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
        if (selectedModel.value && selectedModel.value !== 'mcp-llm') {
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
    enableThinkingMode,
    // 工作目录
    workspaceDirName: workspace.dirName,
    workspaceDirHandle: workspace.dirHandle,
    workspaceTreeSummary: workspace.treeSummary,
    workspaceIsActive: workspace.isActive,
    workspaceSelectDirectory: workspace.selectDirectory,
    workspaceClear: workspace.clear,
    workspaceRefreshTreeSummary: workspace.refreshTreeSummary,
    // 方法
    sendMessage,
    stopGeneration,
    clearMessages,
    newConversation,
    switchConversation,
    loadConversations,
    deleteConversation,
    loadModels,
    loadAgents,
    toggleDebugMode,
    toggleThinkingMode,
    setThinkingMode,
    setLlmModel,
    setAgent,
  }
})

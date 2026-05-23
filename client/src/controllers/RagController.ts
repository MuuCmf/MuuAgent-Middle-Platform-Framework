import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { retrievalService, type RetrievalItem } from '../services/RetrievalService'
import { kbService, type KbInfo } from '../services/KbService'
import { conversationService } from '../services/ConversationService'
import type { Message } from '../api/ai'

/**
 * RAG控制器
 * 封装RAG问答和检索相关的业务逻辑编排
 */
export class RagController {
  /** 知识库列表 */
  kbList = ref<KbInfo[]>([])

  /** 选中的知识库ID */
  selectedKb = ref<string>('')

  /** 返回数量 */
  topN = ref(5)

  /** 相似度阈值 */
  similarityThresh = ref(0.7)

  /** 加载状态 */
  isLoading = ref(false)

  /** 消息列表 */
  messages = ref<Message[]>([])

  /** 当前会话ID */
  currentConversationId = ref<string | null>(null)

  /** 会话列表 */
  conversations = ref<any[]>([])

  /**
   * 选中的知识库信息
   */
  selectedKbInfo = computed(() => {
    return this.kbList.value.find((kb) => kb.kbId === this.selectedKb.value)
  })

  /**
   * 加载知识库列表
   */
  async loadKbList(): Promise<void> {
    try {
      const res = await kbService.getList()
      this.kbList.value = res.data || []
    } catch (error) {
      console.error('加载知识库列表失败:', error)
    }
  }

  /**
   * 设置选中的知识库
   * @param kbId 知识库ID
   */
  setSelectedKb(kbId: string): void {
    this.selectedKb.value = kbId
  }

  /**
   * RAG问答流式调用
   * @param query 查询文本
   * @param modelCode 模型代码
   */
  async ragChat(query: string, modelCode?: string): Promise<void> {
    if (!this.selectedKb.value) {
      ElMessage.warning('请先选择知识库')
      return
    }

    this.isLoading.value = true

    const userMessage: Message = { role: 'user', content: query, timestamp: Date.now() }
    this.messages.value.push(userMessage)

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      type: 'rag',
      sources: [],
      timestamp: Date.now(),
    }
    this.messages.value.push(assistantMessage)
    const assistantIndex = this.messages.value.length - 1

    try {
      await retrievalService.ragChatStream(
        {
          kbId: this.selectedKb.value,
          query,
          topN: this.topN.value,
          similarityThresh: this.similarityThresh.value,
          conversationId: this.currentConversationId.value || undefined,
          modelCode: modelCode === 'mcp-llm' ? undefined : modelCode,
        },
        {
          onMessage: (content: string) => {
            const msg = this.messages.value[assistantIndex]
            msg.content += content

            const newThinkingIndex = msg.content.indexOf('[THINKING]')
            const newAnswerIndex = msg.content.indexOf('[ANSWER]')

            if (newThinkingIndex !== -1 && newAnswerIndex !== -1 && newAnswerIndex > newThinkingIndex) {
              const thinkingContent = msg.content.substring(newThinkingIndex + 10, newAnswerIndex).trim()
              const answerContent = msg.content.substring(newAnswerIndex + 8).trim()
              const beforeThinking = msg.content.substring(0, newThinkingIndex).trim()

              msg.thinkingContent = thinkingContent
              msg.content = beforeThinking + (beforeThinking && answerContent ? '\n\n' : '') + answerContent
            }
          },
          onError: (error: Error) => {
            this.messages.value[assistantIndex].content = '错误: ' + error.message
            ElMessage.error('RAG问答失败: ' + error.message)
            this.isLoading.value = false
          },
          onComplete: (sources?: RetrievalItem[]) => {
            if (sources && sources.length > 0) {
              this.messages.value[assistantIndex].sources = sources
            }
            this.isLoading.value = false
            this.loadRagConversations()
          },
          onConversationId: (conversationId: string) => {
            this.currentConversationId.value = conversationId
          },
        },
      )
    } catch (error: any) {
      this.messages.value[assistantIndex].content = '错误: ' + error.message
      ElMessage.error('RAG问答失败')
      this.isLoading.value = false
    }
  }

  /**
   * 向量检索
   * @param query 查询文本
   */
  async retrieval(query: string): Promise<void> {
    if (!this.selectedKb.value) {
      ElMessage.warning('请先选择知识库')
      return
    }

    this.isLoading.value = true

    const userMessage: Message = { role: 'user', content: query, timestamp: Date.now() }
    this.messages.value.push(userMessage)

    try {
      const res = await retrievalService.retrieval({
        kbId: this.selectedKb.value,
        query,
        topN: this.topN.value,
        similarityThresh: this.similarityThresh.value,
      })

      const results = res.data?.list || []
      this.messages.value.push({
        role: 'assistant',
        content: '',
        type: 'retrieval',
        results,
        timestamp: Date.now(),
      })
    } catch (error: any) {
      const errorMsg = '检索失败: ' + (error.response?.data?.message || error.message)
      this.messages.value.push({ role: 'assistant', content: errorMsg, timestamp: Date.now() })
      ElMessage.error(errorMsg)
    } finally {
      this.isLoading.value = false
    }
  }

  /**
   * 加载RAG会话列表
   */
  async loadRagConversations(): Promise<void> {
    try {
      const params: any = {
        conversationType: 'kb-rag',
        pageSize: 20,
      }
      if (this.selectedKb.value) {
        params.targetId = this.selectedKb.value
      }
      const response = await conversationService.getList(params)
      this.conversations.value = response.data.list || []
    } catch (error) {
      console.error('加载RAG会话列表失败:', error)
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
   * 获取知识库名称
   * @param kbId 知识库ID
   * @returns 知识库名称
   */
  getKbName(kbId: string): string {
    const kb = this.kbList.value.find((k) => k.kbId === kbId)
    return kb?.kbName || kbId
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await this.loadKbList()
  }
}

/** 全局RAG控制器实例 */
export const ragController = new RagController()

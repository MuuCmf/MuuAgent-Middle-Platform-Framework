import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  conversationApi,
  Conversation,
  Message,
  QueryConversationParams,
  CreateConversationParams,
  UpdateConversationParams,
  ConversationType,
  ConversationStatus,
} from '@/api/conversation'

/**
 * 会话管理Store
 */
export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const total = ref(0)
  const loading = ref(false)
  const messagesLoading = ref(false)

  /**
   * 获取会话列表
   * @param params 查询参数
   */
  const fetchConversations = async (params?: QueryConversationParams) => {
    loading.value = true
    try {
      const response = await conversationApi.getList(params)
      conversations.value = response.list
      total.value = response.total
    } catch (error) {
      console.error('获取会话列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取会话详情
   * @param id 会话ID
   * @param messageLimit 消息数量限制
   */
  const fetchConversationDetail = async (id: string, messageLimit?: number) => {
    loading.value = true
    messagesLoading.value = true
    try {
      const response = await conversationApi.getDetail(id, messageLimit)
      currentConversation.value = response.conversation
      messages.value = response.messages || []
    } catch (error) {
      console.error('获取会话详情失败:', error)
      throw error
    } finally {
      loading.value = false
      messagesLoading.value = false
    }
  }

  /**
   * 创建会话
   * @param data 创建参数
   * @returns 创建的会话
   */
  const createConversation = async (data: CreateConversationParams) => {
    try {
      const conversation = await conversationApi.create(data)
      conversations.value.unshift(conversation)
      total.value++
      return conversation
    } catch (error) {
      console.error('创建会话失败:', error)
      throw error
    }
  }

  /**
   * 更新会话
   * @param id 会话ID
   * @param data 更新参数
   * @returns 更新后的会话
   */
  const updateConversation = async (id: string, data: UpdateConversationParams) => {
    try {
      const conversation = await conversationApi.update(id, data)
      const index = conversations.value.findIndex(c => c.id === id)
      if (index !== -1) {
        conversations.value[index] = conversation
      }
      if (currentConversation.value?.id === id) {
        currentConversation.value = conversation
      }
      return conversation
    } catch (error) {
      console.error('更新会话失败:', error)
      throw error
    }
  }

  /**
   * 删除会话
   * @param id 会话ID
   */
  const deleteConversation = async (id: string) => {
    try {
      await conversationApi.delete(id)
      const index = conversations.value.findIndex(c => c.id === id)
      if (index !== -1) {
        conversations.value.splice(index, 1)
        total.value--
      }
      if (currentConversation.value?.id === id) {
        currentConversation.value = null
        messages.value = []
      }
    } catch (error) {
      console.error('删除会话失败:', error)
      throw error
    }
  }

  /**
   * 生成会话标题
   * @param id 会话ID
   */
  const generateTitle = async (id: string) => {
    try {
      const { title } = await conversationApi.generateTitle(id)
      const index = conversations.value.findIndex(c => c.id === id)
      if (index !== -1) {
        conversations.value[index].title = title
      }
      if (currentConversation.value?.id === id) {
        currentConversation.value.title = title
      }
      return title
    } catch (error) {
      console.error('生成会话标题失败:', error)
      throw error
    }
  }

  /**
   * 清空当前会话
   */
  const clearCurrentConversation = () => {
    currentConversation.value = null
    messages.value = []
  }

  /**
   * 根据类型筛选会话
   */
  const conversationsByType = computed(() => {
    return (type: ConversationType) => 
      conversations.value.filter(c => c.conversationType === type)
  })

  /**
   * 根据状态筛选会话
   */
  const conversationsByStatus = computed(() => {
    return (status: ConversationStatus) => 
      conversations.value.filter(c => c.status === status)
  })

  return {
    conversations,
    currentConversation,
    messages,
    total,
    loading,
    messagesLoading,
    fetchConversations,
    fetchConversationDetail,
    createConversation,
    updateConversation,
    deleteConversation,
    generateTitle,
    clearCurrentConversation,
    conversationsByType,
    conversationsByStatus,
  }
})

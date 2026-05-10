<template>
  <div class="chat-view">
    <div class="sidebar">
      <div class="mode-selector">
        <div class="mode-title">对话模式</div>
        <div class="mode-buttons">
          <div
            v-for="item in modeOptions"
            :key="item.value"
            :class="['mode-btn', { active: chatMode === item.value }]"
            @click="chatMode = item.value; handleModeChange()"
          >
            <span class="mode-icon">{{ item.icon }}</span>
            <span class="mode-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
      
      <div v-if="chatMode !== 'chat'" class="kb-selector">
        <div class="kb-title">知识库选择</div>
        <el-select
          v-model="selectedKb"
          placeholder="请选择知识库"
          style="width: 100%"
          @change="handleKbChange"
        >
          <el-option
            v-for="kb in kbList"
            :key="kb.kbId"
            :label="kb.kbName"
            :value="kb.kbId"
          />
        </el-select>
        
        <div v-if="selectedKbInfo" class="kb-info">
          <div class="info-item">
            <span class="info-label">检索方式：</span>
            <span>{{ selectedKbInfo.retrievalMethod === 'bm25' ? 'BM25' : '向量检索' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">文档数量：</span>
            <span>{{ selectedKbInfo.documentCount || 0 }}</span>
          </div>
        </div>
        
        <div class="retrieval-params">
          <div class="param-item">
            <span class="param-label">返回数量 (TopN)</span>
            <el-input-number
              v-model="topN"
              :min="1"
              :max="20"
              :step="1"
              style="width: 100%"
            />
          </div>
          <div class="param-item">
            <span class="param-label">相似度阈值</span>
            <el-slider
              v-model="similarityThresh"
              :min="0"
              :max="1"
              :step="0.1"
              show-input
              :show-input-controls="false"
            />
          </div>
        </div>
      </div>

      <ModelSelector
        v-if="chatMode === 'chat'"
        :type="chatStore.selectedType"
        :model="chatStore.selectedModel"
        :models="chatStore.models"
        :agents="chatStore.agents"
        @change="handleSelectorChange"
      />
      
      <ConversationList
        :conversations="chatStore.conversations"
        :current-id="chatStore.currentConversationId"
        @select="handleSelectConversation"
        @delete="handleDeleteConversation"
        @new="handleNewConversation"
      />
    </div>
    <div class="main-content">
      <div class="chat-header">
        <h2>{{ chatStore.currentConversationTitle }}</h2>
        <div class="header-actions">
          <div v-if="chatStore.selectedType === 'agent'" class="debug-mode-switch">
            <span class="debug-label">调试模式</span>
            <el-switch
              v-model="chatStore.debugMode"
              @change="handleDebugModeChange"
              active-color="#13ce66"
              inactive-color="#ff4949"
            />
          </div>
          <el-button
            v-if="chatStore.currentConversationId"
            type="primary"
            @click="handleNewConversation"
          >
            <el-icon><Plus /></el-icon>
            新对话
          </el-button>
        </div>
      </div>
      <div class="messages-container" ref="messagesRef">
        <div class="messages-wrapper">
          <ChatMessage
            v-for="(message, index) in chatStore.messages"
            :key="index"
            :message="message"
            :is-streaming="isMessageStreaming(index)"
          />
          <div v-if="chatStore.messages.length === 0" class="empty-state">
            <el-icon :size="80" color="#ddd"><ChatDotRound /></el-icon>
            <h3>开始新的对话</h3>
            <p>输入消息开始与AI助手对话</p>
          </div>
        </div>
      </div>
      <ChatInput
        :is-loading="chatStore.isLoading"
        @send="handleSendMessage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, ref, watch, computed } from 'vue'
import { Plus, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../stores/chat'
import { kbApi, type KbInfo } from '../api/kb'
import { retrievalApi, type RetrievalItem } from '../api/retrieval'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ModelSelector from '../components/ModelSelector.vue'
import ConversationList from '../components/ConversationList.vue'

const chatStore = useChatStore()
const messagesRef = ref<HTMLElement>()

const chatMode = ref<'chat' | 'rag' | 'retrieval'>('chat')
const kbList = ref<KbInfo[]>([])
const selectedKb = ref<string>('')
const topN = ref(5)
const similarityThresh = ref(0.7)

/**
 * 对话模式选项
 */
const modeOptions = [
  { value: 'chat' as const, label: '普通对话', icon: '💬' },
  { value: 'rag' as const, label: 'RAG问答', icon: '📚' },
  { value: 'retrieval' as const, label: '向量检索', icon: '🔍' },
]

const selectedKbInfo = computed(() => {
  return kbList.value.find(kb => kb.kbId === selectedKb.value)
})

/**
 * 判断指定索引的消息是否正在流式输出
 * @param index 消息索引
 * @returns 是否正在流式输出
 */
const isMessageStreaming = (index: number): boolean => {
  const messages = chatStore.messages
  if (!chatStore.isLoading) return false
  if (index !== messages.length - 1) return false
  return messages[index].role === 'assistant'
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

/**
 * 加载知识库列表
 */
const loadKbList = async () => {
  try {
    const res = await kbApi.getList()
    kbList.value = res.data || []
  } catch (error) {
    console.error('加载知识库列表失败:', error)
  }
}

/**
 * 处理模式切换
 */
const handleModeChange = () => {
  chatStore.clearMessages()
  if (chatMode.value !== 'chat' && kbList.value.length === 0) {
    loadKbList()
  }
}

/**
 * 处理知识库变更
 */
const handleKbChange = () => {
  chatStore.clearMessages()
}

const handleSendMessage = async (content: string) => {
  if (chatMode.value === 'chat') {
    await chatStore.sendMessage(content)
  } else if (chatMode.value === 'rag') {
    await handleRagChat(content)
  } else if (chatMode.value === 'retrieval') {
    await handleRetrieval(content)
  }
  scrollToBottom()
}

/**
 * 处理RAG问答
 * @param query 用户问题
 */
const handleRagChat = async (query: string) => {
  if (!selectedKb.value) {
    ElMessage.warning('请先选择知识库')
    return
  }

  chatStore.isLoading = true
  
  const userMessage = { role: 'user' as const, content: query }
  chatStore.messages.push(userMessage)
  
  const assistantMessage = {
    role: 'assistant' as const,
    content: '',
    type: 'rag' as const,
    sources: []
  }
  chatStore.messages.push(assistantMessage)
  const assistantIndex = chatStore.messages.length - 1

  try {
    await retrievalApi.ragChatStream(
      {
        kbId: selectedKb.value,
        query,
        topN: topN.value,
        similarityThresh: similarityThresh.value
      },
      {
        onMessage: (content: string) => {
          chatStore.messages[assistantIndex].content += content
          scrollToBottom()
        },
        onError: (error: Error) => {
          chatStore.messages[assistantIndex].content = '错误: ' + error.message
          ElMessage.error('RAG问答失败: ' + error.message)
          chatStore.isLoading = false
        },
        onComplete: (sources?: RetrievalItem[]) => {
          if (sources && sources.length > 0) {
            chatStore.messages[assistantIndex].sources = sources
          }
          chatStore.isLoading = false
        }
      }
    )
  } catch (error: any) {
    chatStore.messages[assistantIndex].content = '错误: ' + error.message
    ElMessage.error('RAG问答失败')
    chatStore.isLoading = false
  }
}

/**
 * 处理向量检索
 * @param query 检索查询
 */
const handleRetrieval = async (query: string) => {
  if (!selectedKb.value) {
    ElMessage.warning('请先选择知识库')
    return
  }

  chatStore.isLoading = true
  
  const userMessage = { role: 'user' as const, content: query }
  chatStore.messages.push(userMessage)

  try {
    const res = await retrievalApi.retrieval({
      kbId: selectedKb.value,
      query,
      topN: topN.value,
      similarityThresh: similarityThresh.value
    })

    const results = res.data?.list || []
    chatStore.messages.push({
      role: 'assistant',
      content: '',
      type: 'retrieval',
      results
    })
  } catch (error: any) {
    const errorMsg = '检索失败: ' + (error.response?.data?.message || error.message)
    chatStore.messages.push({ role: 'assistant', content: errorMsg })
    ElMessage.error(errorMsg)
  } finally {
    chatStore.isLoading = false
  }
}

const handleSelectorChange = async (data: { type: 'model' | 'agent'; value: string }) => {
  chatStore.selectedType = data.type
  chatStore.selectedModel = data.value
  chatStore.clearMessages()
  await chatStore.loadConversations()
}

const handleSelectConversation = async (conversationId: string) => {
  await chatStore.switchConversation(conversationId)
  scrollToBottom()
}

const handleDeleteConversation = async (conversationId: string) => {
  try {
    await chatStore.deleteConversation(conversationId)
    ElMessage.success('会话已删除')
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleNewConversation = () => {
  chatStore.newConversation()
}

const handleDebugModeChange = (value: boolean) => {
  ElMessage.success(value ? '已开启调试模式，将显示推理过程' : '已关闭调试模式')
}

watch(() => chatStore.messages.length, () => {
  scrollToBottom()
})

onMounted(async () => {
  await chatStore.loadModels()
  await chatStore.loadAgents()
  await chatStore.loadConversations()
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.mode-selector {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;

  .mode-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
  }

  .mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;
    color: #606266;
    background: #fff;

    &:hover {
      border-color: #667eea;
      color: #667eea;
    }

    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
      color: #fff;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    .mode-icon {
      font-size: 16px;
    }

    .mode-label {
      flex: 1;
    }
  }
}

.kb-selector {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;

  .kb-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
  }

  .kb-info {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;

    .info-item {
      display: flex;
      font-size: 13px;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        color: #999;
        width: 80px;
        flex-shrink: 0;
      }

      span:last-child {
        color: #333;
      }
    }
  }

  .retrieval-params {
    margin-top: 12px;

    .param-item {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .param-label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chat-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.debug-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f5f7fa;
  border-radius: 20px;
  transition: all 0.3s;
}

.debug-mode-switch:hover {
  background: #e8e8e8;
}

.debug-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.messages-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-state h3 {
  margin: 24px 0 12px;
  font-size: 24px;
  color: #333;
}

.empty-state p {
  margin: 0;
  color: #999;
  font-size: 16px;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}
</style>

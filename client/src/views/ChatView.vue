<template>
  <div class="chat-view">
    <div class="sidebar">
      <ModelSelector
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
import { onMounted, nextTick, ref, watch } from 'vue'
import { Plus, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../stores/chat'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ModelSelector from '../components/ModelSelector.vue'
import ConversationList from '../components/ConversationList.vue'

const chatStore = useChatStore()
const messagesRef = ref<HTMLElement>()

const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

const handleSendMessage = async (content: string) => {
  await chatStore.sendMessage(content)
  scrollToBottom()
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

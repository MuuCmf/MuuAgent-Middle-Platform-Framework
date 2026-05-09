<template>
  <div class="page-container">
    <ChatHeader />

    <div class="card">
      <div class="card-title">💬 AI对话测试</div>

      <ChatModeSelector
        v-model:chatMode="chatMode"
        v-model:selectedModel="selectedModel"
        v-model:selectedAgent="selectedAgent"
        v-model:selectedKb="selectedKb"
        v-model:retrievalTopN="retrievalTopN"
        v-model:retrievalThreshold="retrievalThreshold"
        v-model:currentConversationId="currentConversationId"
        :enabledModels="enabledModels"
        :enabledAgents="enabledAgents"
        :enabledKbs="enabledKbs"
        :quickQuestions="quickQuestions"
        :kbQuickQuestions="kbQuickQuestions"
        @quick-question="handleQuickQuestion"
        @conversation-change="handleConversationChange"
      />

      <div class="chat-container">
        <ChatMessageList
          ref="chatMessagesRef"
          :messages="chatMessages"
          :loading="chatLoading"
          :chatMode="chatMode"
        />
        <ChatInput
          v-model:input="chatInput"
          :loading="chatLoading"
          :messagesEmpty="chatMessages.length === 0"
          @send="sendMessage"
          @clear="clearMessages"
          @new-conversation="newConversation"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useChat } from './composables/useChat'
import ChatHeader from './components/ChatHeader.vue'
import ChatModeSelector from './components/ChatModeSelector.vue'
import ChatMessageList from './components/ChatMessageList.vue'
import ChatInput from './components/ChatInput.vue'

const {
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
  currentConversationId,
  enabledModels,
  enabledAgents,
  enabledKbs,
  quickQuestions,
  kbQuickQuestions,
  sendMessage,
  clearMessages,
  newConversation,
  init
} = useChat()

const handleQuickQuestion = (question: string) => {
  chatInput.value = question
}

const handleConversationChange = (conversationId: string | null) => {
  console.log('[Chat] 会话切换，新 conversationId:', conversationId)
  console.log('[Chat] 切换前 currentConversationId:', currentConversationId.value)
  currentConversationId.value = conversationId
  console.log('[Chat] 切换后 currentConversationId:', currentConversationId.value)
  if (conversationId) {
    console.log('[Chat] 已切换到会话:', conversationId)
  } else {
    console.log('[Chat] 已清空会话，将创建新会话')
  }
}

onMounted(() => {
  init()
})
</script>

<style lang="scss" scoped>
.chat-container {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  overflow: hidden;
}
</style>

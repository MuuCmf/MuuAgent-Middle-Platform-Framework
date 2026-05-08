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
        :enabledModels="enabledModels"
        :enabledAgents="enabledAgents"
        :enabledKbs="enabledKbs"
        :quickQuestions="quickQuestions"
        :kbQuickQuestions="kbQuickQuestions"
        @quick-question="handleQuickQuestion"
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
  enabledModels,
  enabledAgents,
  enabledKbs,
  quickQuestions,
  kbQuickQuestions,
  sendMessage,
  clearMessages,
  init
} = useChat()

const handleQuickQuestion = (question: string) => {
  chatInput.value = question
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

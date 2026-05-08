<template>
  <div class="chat-messages" ref="messagesRef">
    <div v-if="!messages.length" class="empty">
      <p>👋 开始对话吧！</p>
      <p style="font-size: 12px; color: #999; margin-top: 8px">
        <template v-if="chatMode === 'mcp'">当前为MCP调度模式，系统将自动选择最优模型</template>
        <template v-else-if="chatMode === 'model'">当前为模型选择模式，请选择一个模型</template>
        <template v-else-if="chatMode === 'agent'">当前为智能体对话模式，请选择一个智能体</template>
        <template v-else-if="chatMode === 'kb-retrieval'">当前为知识库检索模式，请选择一个知识库</template>
        <template v-else>当前为RAG问答模式，请选择一个知识库</template>
      </p>
    </div>
    <ChatMessage v-for="(msg, idx) in messages" :key="idx" :message="msg" />
    <div v-if="loading" class="loading">
      <span>🤔 AI正在思考...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ChatMessage as ChatMessageType } from '../composables/useChat'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{
  messages: ChatMessageType[]
  loading: boolean
  chatMode: string
}>()

const messagesRef = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

watch(() => props.messages, () => {
  scrollToBottom()
}, { deep: true })

watch(() => props.loading, () => {
  scrollToBottom()
})

defineExpose({
  scrollToBottom
})
</script>

<style lang="scss" scoped>
.chat-messages {
  height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px 20px;

  p {
    margin: 0;
  }
}

.loading {
  text-align: center;
  padding: 16px;
  color: #666;
}
</style>

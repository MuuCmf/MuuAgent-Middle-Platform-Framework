<template>
  <div :class="['message', message.role]">
    <div class="message-avatar">
      <div v-if="message.role === 'user'" class="avatar user-avatar">
        <el-icon><User /></el-icon>
      </div>
      <div v-else class="avatar assistant-avatar">
        <el-icon><ChatDotRound /></el-icon>
      </div>
    </div>
    <div class="message-content">
      <div class="message-role">
        {{ message.role === 'user' ? '我' : 'AI助手' }}
      </div>
      <div class="message-text" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import { User, ChatDotRound } from '@element-plus/icons-vue'
import type { Message } from '../api'

interface Props {
  message: Message
}

const props = defineProps<Props>()

const renderedContent = computed(() => {
  if (props.message.role === 'user') {
    return props.message.content
  }
  return marked(props.message.content) as string
})
</script>

<style scoped>
.message {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.assistant-avatar {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.message-content {
  flex: 1;
  max-width: 70%;
}

.message.user .message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-role {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.message-text {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 12px;
  line-height: 1.6;
  word-wrap: break-word;
}

.message.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-text :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}

.message-text :deep(code) {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.message-text :deep(pre code) {
  background: transparent;
  padding: 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.message-text :deep(p) {
  margin: 8px 0;
}

.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  margin: 16px 0 8px;
  font-weight: 600;
}
</style>

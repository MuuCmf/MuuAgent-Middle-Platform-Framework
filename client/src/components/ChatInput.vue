<template>
  <div class="chat-input">
    <div class="input-container">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        placeholder="输入消息... (Enter发送, Shift+Enter换行)"
        @keydown="handleKeydown"
        :disabled="isLoading"
        resize="none"
      />
      <div class="input-actions">
        <el-button
          type="primary"
          :loading="isLoading"
          :disabled="!inputText.trim()"
          @click="handleSend"
          circle
        >
          <el-icon><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Promotion } from '@element-plus/icons-vue'

interface Props {
  isLoading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  send: [content: string]
}>()

const inputText = ref('')

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (inputText.value.trim()) {
    emit('send', inputText.value)
    inputText.value = ''
  }
}
</script>

<style scoped>
.chat-input {
  padding: 20px;
  background: white;
  border-top: 1px solid #e8e8e8;
}

.input-container {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
}

.input-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

:deep(.el-textarea__inner) {
  padding-right: 60px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
}

:deep(.el-textarea__inner:focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}
</style>

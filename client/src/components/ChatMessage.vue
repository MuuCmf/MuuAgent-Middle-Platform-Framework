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
      
      <!-- 推理过程显示 -->
      <ReasoningProcess 
        v-if="message.role === 'assistant' && message.reasoningSteps && message.reasoningSteps.length > 0"
        :steps="message.reasoningSteps"
        :finalAnswer="message.content"
      />
      
      <!-- 用户消息：普通文本显示 -->
      <div 
        v-if="message.role === 'user'"
        class="message-text"
      >{{ message.content }}</div>
      
      <!-- AI消息：使用vue-stream-markdown渲染 -->
      <Markdown
        v-else
        :content="message.content"
        :mode="isStreaming ? 'streaming' : 'static'"
        :controls="markdownControls"
        :codeOptions="codeOptions"
        :shikiOptions="shikiOptions"
        class="message-text"
        @copied="handleCopied"
      />
      
      <!-- 流式输出时的打字光标 -->
      <div v-if="isStreaming && message.role === 'assistant'" class="typing-cursor">
        <span class="cursor"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { User, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Message } from '../api'
import ReasoningProcess from './ReasoningProcess.vue'
import { Markdown } from 'vue-stream-markdown'
import type { ControlsConfig, CodeOptions, ShikiOptions } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const messageTextRef = ref<HTMLElement | null>(null)
let scrollContainer: HTMLElement | null = null

const markdownControls: ControlsConfig = {
  code: {
    copy: true,
    download: true,
    fullscreen: true,
    collapse: true
  },
  table: {
    copy: true,
    download: true,
    fullscreen: true
  },
  image: {
    preview: true,
    download: true
  }
}

const codeOptions: CodeOptions = {
  lineNumbers: true,
  languageIcon: true,
  languageName: true,
  maxHeight: '500px'
}

const shikiOptions: ShikiOptions = {
  theme: ['github-light', 'github-dark']
}

function handleCopied(): void {
  ElMessage.success('代码已复制到剪贴板')
}

function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent)
    if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

onMounted(() => {
  if (messageTextRef.value) {
    scrollContainer = findScrollContainer(messageTextRef.value)
  }
})

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer = null
  }
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
  line-height: 1.8;
  word-wrap: break-word;
}

.message.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

/* 打字光标样式 */
.typing-cursor {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
}

.typing-cursor .cursor {
  display: inline-block;
  width: 2px;
  height: 18px;
  background: #6366f1;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}
</style>

<style>
/* 全局样式：优化代码块UI */
.message-text pre {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-text pre code {
  display: block;
  padding: 16px;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  overflow-x: auto;
}

.message-text code:not(pre code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 0.9em;
  color: #e83e8c;
}

.message.user .message-text code:not(pre code) {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 代码块头部样式 */
.message-text .code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 13px;
  color: #999;
}

.message-text .code-language {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.message-text .code-actions {
  display: flex;
  gap: 8px;
}

.message-text .code-action {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.message-text .code-action:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 行号样式 */
.message-text .line-number {
  display: inline-block;
  width: 40px;
  padding-right: 16px;
  text-align: right;
  color: #6366f1;
  opacity: 0.5;
  user-select: none;
}

/* 代码块滚动条样式 */
.message-text pre::-webkit-scrollbar {
  height: 8px;
}

.message-text pre::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.message-text pre::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.message-text pre::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>

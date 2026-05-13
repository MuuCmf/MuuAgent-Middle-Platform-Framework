<template>
  <div class="chat-input">
    <div class="input-wrapper">
      <!-- 模式选择器 -->
      <div class="mode-selector-bar">
        <div class="mode-tabs">
          <div
            v-for="item in modeOptions"
            :key="item.value"
            :class="['mode-tab', { active: currentMode === item.value }]"
            @click="handleModeChange(item.value)"
          >
            <span class="mode-icon">{{ item.icon }}</span>
            <span class="mode-label">{{ item.label }}</span>
          </div>
        </div>
        <div class="mode-indicator">
          <span class="indicator-dot"></span>
          <span class="indicator-text">{{ getCurrentModeText() }}</span>
        </div>
      </div>

      <!-- 智能体横向滚动选择器 -->
      <div v-if="currentMode === 'chat'" class="agent-scroll-selector">
        <div class="agent-scroll-container">
          <div
            :class="['agent-chip', { active: !selectedAgent }]"
            @click="handleAgentSelect('')"
          >
            <el-icon :size="14"><Cpu /></el-icon>
            <span>大模型对话</span>
            <el-icon v-if="!selectedAgent" :size="12" class="check-icon"><Check /></el-icon>
          </div>
          <div
            v-for="agent in agents"
            :key="agent.id"
            :class="['agent-chip', { active: selectedAgent === agent.id }]"
            @click="handleAgentSelect(agent.id)"
          >
            <el-icon :size="14"><User /></el-icon>
            <span>{{ agent.name }}</span>
            <el-icon v-if="selectedAgent === agent.id" :size="12" class="check-icon"><Check /></el-icon>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="input-container">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          :placeholder="getPlaceholder()"
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Promotion, Check, Cpu, User } from '@element-plus/icons-vue'

interface Agent {
  id: string
  name: string
  description?: string
  status?: boolean
}

interface Props {
  isLoading: boolean
  mode?: 'chat' | 'rag' | 'retrieval'
  agents?: Agent[]
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'chat',
  agents: () => [],
})

const emit = defineEmits<{
  send: [content: string]
  'update:mode': [value: 'chat' | 'rag' | 'retrieval']
  'mode-change': [value: 'chat' | 'rag' | 'retrieval']
  'agent-change': [agentId: string]
}>()

const inputText = ref('')
const currentMode = ref<'chat' | 'rag' | 'retrieval'>(props.mode)
const selectedAgent = ref<string>('')

watch(() => props.mode, (newMode) => {
  currentMode.value = newMode
})

const modeOptions = [
  { value: 'chat' as const, label: '对话', icon: '💬' },
  { value: 'rag' as const, label: 'RAG', icon: '📚' },
  { value: 'retrieval' as const, label: '检索', icon: '🔍' },
]

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

const handleModeChange = (mode: 'chat' | 'rag' | 'retrieval') => {
  currentMode.value = mode
  if (mode !== 'chat') {
    selectedAgent.value = ''
    emit('agent-change', '')
  }
  emit('update:mode', mode)
  emit('mode-change', mode)
}

const handleAgentSelect = (agentId: string) => {
  selectedAgent.value = agentId
  emit('agent-change', agentId)
}

const getCurrentModeText = (): string => {
  if (currentMode.value === 'chat') {
    return selectedAgent.value ? '智能体对话' : '大模型对话'
  }
  switch (currentMode.value) {
    case 'rag': return 'RAG问答模式'
    case 'retrieval': return '向量检索模式'
    default: return ''
  }
}

const getPlaceholder = (): string => {
  if (currentMode.value === 'chat' && selectedAgent.value) {
    return '输入消息与智能体对话...'
  }
  switch (currentMode.value) {
    case 'chat': return '输入消息开始对话...'
    case 'rag': return '输入问题，基于知识库进行问答...'
    case 'retrieval': return '输入关键词进行向量检索...'
    default: return '输入消息...'
  }
}
</script>

<style scoped>
.chat-input {
  padding: 16px 24px 24px;
  background: linear-gradient(180deg, #f8f9ff 0%, #ffffff 100%);
  border-top: 1px solid #e8e8e8;
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.mode-selector-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px;
  background: white;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.08);
}

.mode-tabs {
  display: flex;
  gap: 4px;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
}

.mode-tab:hover {
  background: #f0f5ff;
}

.mode-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

.mode-tab.active .mode-icon {
  font-size: 16px;
}

.mode-tab.active .mode-label {
  color: white;
  font-weight: 600;
}

.mode-icon {
  font-size: 14px;
}

.mode-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.mode-tab:not(.active) .mode-label {
  color: #606266;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f5f7fa;
  border-radius: 20px;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.indicator-text {
  font-size: 12px;
  color: #667eea;
  font-weight: 500;
}

.agent-scroll-selector {
  margin-bottom: 12px;
  overflow: hidden;
}

.agent-scroll-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.agent-scroll-container::-webkit-scrollbar {
  display: none;
}

.agent-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: white;
  border: 1.5px solid #e8e8e8;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.agent-chip:hover {
  border-color: #667eea;
  background: #f0f5ff;
  transform: translateY(-1px);
}

.agent-chip.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.agent-chip.active span {
  color: white;
}

.agent-chip.active .el-icon {
  color: white;
}

.agent-chip .check-icon {
  margin-left: 2px;
}

.agent-chip span {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.agent-chip .el-icon {
  color: #667eea;
}

.input-container {
  position: relative;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.input-actions {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  align-items: center;
}

:deep(.el-textarea__inner) {
  padding: 16px 70px 16px 20px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

:deep(.el-textarea__inner:focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

:deep(.el-button--primary:disabled) {
  background: #dcdfe6;
  box-shadow: none;
}
</style>
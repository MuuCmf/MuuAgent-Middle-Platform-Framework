<template>
  <div class="chat-input">
    <div class="input-wrapper">
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
          <span class="indicator-dot" />
          <span class="indicator-text">{{ getCurrentModeText() }}</span>
        </div>
      </div>

      <div v-if="currentMode === 'chat'" class="workspace-agent-bar">
        <div class="agent-scroll-section">
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
        <div v-if="isWorkspaceEnabledForSelectedAgent" class="workspace-section">
          <WorkspaceIndicator
            :is-active="workspaceIsActive"
            :dir-name="workspaceDirName"
            @select="handleWorkspaceSelect"
            @change="handleWorkspaceSelect"
            @clear="handleWorkspaceClear"
          />
        </div>
      </div>

      <div v-if="showCommandMenu" class="command-menu">
        <div
          v-for="(cmd, idx) in filteredCommands"
          :key="cmd.name"
          :class="['command-item', { active: idx === commandIndex }]"
          @click="selectCommand(cmd)"
          @mouseenter="commandIndex = idx"
        >
          <span class="command-name">/{{ cmd.name }}</span>
          <span class="command-desc">{{ cmd.description }}</span>
        </div>
      </div>

      <div class="input-container">
        <el-input
          ref="inputRef"
          v-model="inputText"
          type="textarea"
          :rows="3"
          :placeholder="getPlaceholder()"
          @keydown="handleKeydown"
          @input="handleInput"
          :disabled="isLoading"
          resize="none"
        />
        <div class="input-actions">
          <el-button
            v-if="isLoading"
            type="danger"
            @click="emit('stop')"
            circle
          >
            <el-icon><VideoPause /></el-icon>
          </el-button>
          <el-button
            v-else
            type="primary"
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
import { ref, watch, computed, nextTick } from 'vue'
import { Promotion, Check, Cpu, User, VideoPause } from '@element-plus/icons-vue'
import WorkspaceIndicator from '@/views/chat/components/WorkspaceIndicator.vue'

/**
 * 斜杠命令定义
 */
interface SlashCommand {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description: string
  /** 命令动作 */
  action: () => void
}

/**
 * 智能体定义
 */
interface Agent {
  /** 智能体ID */
  id: string
  /** 智能体名称 */
  name: string
  /** 描述 */
  description?: string
  /** 状态 */
  status?: boolean
}

interface Props {
  /** 加载状态 */
  isLoading: boolean
  /** 聊天模式 */
  mode?: 'chat' | 'rag' | 'retrieval'
  /** 智能体列表 */
  agents?: Agent[]
  /** 工作目录是否激活 */
  workspaceIsActive?: boolean
  /** 工作目录名称 */
  workspaceDirName?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'chat',
  agents: () => [],
  workspaceIsActive: false,
  workspaceDirName: null,
})

const emit = defineEmits<{
  /** 发送消息 */
  send: [content: string]
  /** 停止生成 */
  stop: []
  /** 模式更新 */
  'update:mode': [value: 'chat' | 'rag' | 'retrieval']
  /** 模式变更 */
  'mode-change': [value: 'chat' | 'rag' | 'retrieval']
  /** 智能体变更 */
  'agent-change': [agentId: string]
  /** 工作目录选择 */
  'workspace-select': []
  /** 工作目录清除 */
  'workspace-clear': []
}>()

/** 输入文本 */
const inputText = ref('')
/** 当前模式 */
const currentMode = ref<'chat' | 'rag' | 'retrieval'>(props.mode)
/** 选中的智能体 */
const selectedAgent = ref<string>('')
/** 输入框引用 */
const inputRef = ref<any>(null)
/** 斜杠命令菜单是否显示 */
const showCommandMenu = ref(false)
/** 斜杠命令当前选中索引 */
const commandIndex = ref(0)

/**
 * 斜杠命令列表
 */
const slashCommands: SlashCommand[] = [
  { name: 'chat', description: '切换到对话模式', action: () => handleModeChange('chat') },
  { name: 'rag', description: '切换到RAG问答模式', action: () => handleModeChange('rag') },
  { name: 'search', description: '切换到向量检索模式', action: () => handleModeChange('retrieval') },
  { name: 'clear', description: '清空当前对话', action: () => { inputText.value = '' } },
  { name: 'new', description: '新建对话', action: () => { inputText.value = '' } },
]

/**
 * 根据输入过滤斜杠命令
 */
const filteredCommands = computed(() => {
  if (!inputText.value.startsWith('/')) return []
  const query = inputText.value.slice(1).toLowerCase()
  return slashCommands.filter((cmd) => cmd.name.includes(query))
})

/**
 * 判断当前选中的智能体是否支持工作目录
 */
const isWorkspaceEnabledForSelectedAgent = computed(() => {
  return !!selectedAgent.value
})

watch(() => props.mode, (newMode) => {
  currentMode.value = newMode
})

/** 模式选项 */
const modeOptions = [
  { value: 'chat' as const, label: '对话', icon: '💬' },
  { value: 'rag' as const, label: 'RAG', icon: '📚' },
  { value: 'retrieval' as const, label: '检索', icon: '🔍' },
]

/**
 * 处理键盘事件
 * @param e 键盘事件
 */
const handleKeydown = (e: KeyboardEvent) => {
  if (showCommandMenu.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      commandIndex.value = Math.min(commandIndex.value + 1, filteredCommands.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      commandIndex.value = Math.max(commandIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (filteredCommands.value.length > 0) {
        selectCommand(filteredCommands.value[commandIndex.value])
      }
      return
    }
    if (e.key === 'Escape') {
      showCommandMenu.value = false
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

/**
 * 处理输入变化
 */
const handleInput = () => {
  if (inputText.value.startsWith('/') && filteredCommands.value.length > 0) {
    showCommandMenu.value = true
    commandIndex.value = 0
  } else {
    showCommandMenu.value = false
  }
}

/**
 * 选择斜杠命令
 * @param cmd 命令对象
 */
const selectCommand = (cmd: SlashCommand) => {
  showCommandMenu.value = false
  inputText.value = ''
  cmd.action()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

/**
 * 发送消息
 */
const handleSend = () => {
  if (inputText.value.trim()) {
    emit('send', inputText.value)
    inputText.value = ''
    showCommandMenu.value = false
  }
}

/**
 * 处理模式切换
 * @param mode 目标模式
 */
const handleModeChange = (mode: 'chat' | 'rag' | 'retrieval') => {
  const wasChatMode = currentMode.value === 'chat'
  currentMode.value = mode
  if (mode !== 'chat') {
    selectedAgent.value = ''
  } else if (!wasChatMode) {
    emit('agent-change', selectedAgent.value)
  }
  emit('update:mode', mode)
  emit('mode-change', mode)
}

/**
 * 处理智能体选择
 * @param agentId 智能体ID
 */
const handleAgentSelect = (agentId: string) => {
  selectedAgent.value = agentId
  emit('agent-change', agentId)
}

/**
 * 处理工作目录选择
 */
const handleWorkspaceSelect = () => {
  emit('workspace-select')
}

/**
 * 处理工作目录清除
 */
const handleWorkspaceClear = () => {
  emit('workspace-clear')
}

/**
 * 获取当前模式文本
 * @returns 模式文本
 */
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

/**
 * 获取输入框占位文本
 * @returns 占位文本
 */
const getPlaceholder = (): string => {
  if (currentMode.value === 'chat' && selectedAgent.value) {
    return '输入消息与智能体对话... (输入 / 查看命令)'
  }
  switch (currentMode.value) {
    case 'chat': return '输入消息开始对话... (输入 / 查看命令)'
    case 'rag': return '输入问题，基于知识库进行问答...'
    case 'retrieval': return '输入关键词进行向量检索...'
    default: return '输入消息...'
  }
}
</script>

<style scoped>
.chat-input {
  padding: 16px 24px 24px;
  background: var(--white);
  border-top: 1px solid var(--border-color);
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}

.mode-selector-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
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
  background: var(--bg-tertiary);
}

.mode-tab.active {
  background: var(--primary-gradient);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

.mode-tab.active .mode-icon { font-size: 16px; }
.mode-tab.active .mode-label { color: white; font-weight: 600; }
.mode-icon { font-size: 14px; }
.mode-label { font-size: 14px; color: var(--text-secondary); font-weight: 500; }

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--bg-tertiary);
  border-radius: 20px;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-gradient);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.indicator-text {
  font-size: 12px;
  color: var(--primary-color);
  font-weight: 500;
}

.workspace-agent-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.workspace-section { flex-shrink: 0; }

.agent-scroll-section {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

.agent-scroll-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.agent-scroll-container::-webkit-scrollbar { display: none; }

.agent-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--white);
  border: 1.5px solid var(--border-color);
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.agent-chip:hover {
  border-color: var(--primary-color);
  background: var(--bg-color);
  transform: translateY(-1px);
}

.agent-chip.active {
  background: var(--primary-gradient);
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.agent-chip.active span { color: white; }
.agent-chip.active .el-icon { color: white; }
.agent-chip .check-icon { margin-left: 2px; }
.agent-chip span { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.agent-chip .el-icon { color: var(--primary-color); }

.command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.command-item:hover,
.command-item.active {
  background: var(--bg-color);
}

.command-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  min-width: 80px;
}

.command-desc {
  font-size: 13px;
  color: var(--text-tertiary);
}

.input-container {
  position: relative;
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
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

.input-actions .el-button {
  padding: 0;
  width: 44px;
  height: 44px;
}

:deep(.el-textarea__inner) {
  padding: 16px 70px 16px 20px;
  border-radius: var(--radius-lg);
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  background: var(--white);
  color: var(--text-color);
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

:deep(.el-button--primary) {
  background: var(--primary-gradient);
  border: none;
  width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

:deep(.el-button--primary:disabled) {
  background: var(--bg-tertiary);
  box-shadow: none;
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #f56c6c 0%, #e6474b 100%);
  border: none;
  width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
  transition: all 0.3s ease;
}

:deep(.el-button--danger:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
}

@media (max-width: 768px) {
  .chat-input {
    padding: 12px 16px 16px;
  }

  .mode-selector-bar {
    flex-direction: column;
    gap: 8px;
  }

  .mode-tabs {
    width: 100%;
    justify-content: center;
  }

  .mode-tab {
    padding: 6px 12px;
  }

  .mode-label {
    font-size: 12px;
  }

  .workspace-agent-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-section {
    width: 100%;
  }
}
</style>

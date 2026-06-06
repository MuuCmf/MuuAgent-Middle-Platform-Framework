<template>
  <AppShell :show-right-sidebar="workspaceIsActive" :right-sidebar-width="280">
    <template #sidebar>
      <ChatSidebar
        :chat-mode="chatMode"
        :selected-agent="selectedAgent"
        :selected-kb="selectedKb"
        :kb-list="kbList"
        :selected-kb-info="selectedKbInfo"
        :top-n="topN"
        :similarity-thresh="similarityThresh"
        :tool-policies="toolPolicies"
        :conversations="conversations"
        :current-conversation-id="currentConversationId"
        :agents="enabledAgents"
        @agent-change="handleAgentChange"
        @kb-change="handleKbChange"
        @kb-select="(val: string) => selectedKb = val"
        @top-n-change="(val: number) => topN = val"
        @similarity-thresh-change="(val: number) => similarityThresh = val"
        @select-conversation="handleSelectConversation"
        @delete-conversation="handleDeleteConversation"
        @new-conversation="handleNewConversation"
      />
    </template>

    <template #main>
      <div class="chat-main">
        <AppHeader>
          <template #left>
            <div class="header-info">
              <h2>{{ currentConversationTitle }}</h2>
              <div class="header-tags">
                <span v-if="selectedLlmModel === 'mcp-llm'" class="model-tag mcp-tag">
                  <el-icon :size="14"><Star /></el-icon>
                  Auto 智能调度
                </span>
                <span v-else class="model-tag specified-tag">
                  <el-icon :size="14"><Cpu /></el-icon>
                  {{ getModelName(selectedLlmModel) }}
                </span>
                <span v-if="selectedAgent && chatMode === 'chat'" class="agent-tag">
                  <el-icon :size="14"><User /></el-icon>
                  {{ getAgentName(selectedAgent) }}
                </span>
                <span
                  v-if="selectedKb && (chatMode === 'rag' || chatMode === 'retrieval')"
                  class="kb-tag"
                >
                  <el-icon :size="14"><ChatLineRound /></el-icon>
                  {{ getKbName(selectedKb) }}
                </span>
                <span v-if="workspaceIsActive" class="workspace-tag">
                  <el-icon :size="14"><FolderOpened /></el-icon>
                  {{ workspaceDirName }}
                </span>
              </div>
            </div>
          </template>
          <template #actions>
            <div class="header-voice-video">
              <!-- S2S 端到端语音对话开关 -->
              <div class="av-trigger" :class="{ active: s2sEnabled }" @click="handleS2sToggle" title="实时语音对话（端到端）">
                <el-icon :size="18"><Microphone /></el-icon>
                <span class="av-trigger-badge" :class="{ active: s2sEnabled }" />
              </div>
              <!-- 音视频对话主开关 -->
              <div class="av-trigger" :class="{ active: videoEnabled }" @click="handleVideoToggleFromHeader" title="音视频对话（点击开启/关闭）">
                <el-icon :size="18"><VideoCamera /></el-icon>
                <span class="av-trigger-badge" :class="{ active: videoEnabled }" />
              </div>
              <!-- 语音播报设置 -->
              <div class="av-trigger" :class="{ active: voiceEnabled }" @click="handleVoiceSettings" title="语音播报设置（点击打开设置）">
                <el-icon :size="18"><Headset /></el-icon>
                <span class="av-trigger-badge" :class="{ active: voiceEnabled }" />
              </div>
            </div>
            <ThemeToggle />
            <el-button
              v-if="currentConversationId"
              type="primary"
              @click="handleNewConversation"
            >
              <el-icon><Plus /></el-icon>
              新对话
            </el-button>
          </template>
        </AppHeader>

        <div class="messages-container" ref="messagesRef">
          <div class="messages-wrapper">
            <ChatMessage
              v-for="(message, index) in messages"
              :key="index"
              :message="message"
              :is-streaming="isMessageStreaming(index)"
              :tts-status="ttsStatus"
            />
            <div v-if="messages.length === 0" class="empty-state">
              <el-icon :size="80" color="#ddd"><ChatDotRound /></el-icon>
              <h3>{{ getEmptyTitle() }}</h3>
              <p>{{ getEmptyDescription() }}</p>
            </div>
          </div>
        </div>

        <ChatInput
          ref="chatInputRef"
          :is-loading="isLoading"
          :mode="chatMode"
          :agents="enabledAgents"
          :workspace-is-active="workspaceIsActive"
          :workspace-dir-name="workspaceDirName"
          :models="filteredModels"
          :selected-llm-model="selectedLlmModel"
          :selected-model-type="selectedModelType"
          @send="handleSendMessage"
          @stop="handleStopGeneration"
          @mode-change="handleModeChange"
          @agent-change="handleAgentChange"
          @workspace-select="handleWorkspaceSelect"
          @workspace-clear="handleWorkspaceClear"
          @llm-model-change="handleLlmModelChange"
          @model-type-change="handleModelTypeChange"
          @file-upload="handleFileUpload"
        />
      </div>
    </template>

    <template #right-sidebar>
      <WorkspaceSidebar
        :dir-name="workspaceDirName"
        :file-tree="workspaceFileTree"
        :is-loading="workspaceIsLoading"
        @refresh="handleWorkspaceRefresh"
        @close="handleWorkspaceClear"
        @file-click="handleFileClick"
      />
    </template>
  </AppShell>
  <VoiceSettings ref="voiceSettingsRef" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, ChatDotRound, Cpu, Star, User, ChatLineRound, FolderOpened, Headset, VideoCamera, Microphone } from '@element-plus/icons-vue'
import AppShell from '../../components/layout/AppShell.vue'
import AppHeader from '../../components/layout/AppHeader.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import ChatSidebar from './components/ChatSidebar.vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import WorkspaceSidebar from './components/WorkspaceSidebar.vue'
import VoiceSettings from './components/VoiceSettings.vue'
import { useChat } from '../../composables/useChat'

/** ChatInput 组件引用，用于控制摄像头面板 */
const chatInputRef = ref<InstanceType<typeof ChatInput>>()
/** 语音设置弹窗引用 */
const voiceSettingsRef = ref<InstanceType<typeof VoiceSettings>>()

/**
 * 从 AppHeader 触发音视频切换
 * 控制 ChatInput 内的摄像头面板开关
 */
const handleVideoToggleFromHeader = () => {
  if (videoEnabled.value) {
    // 已经开启音视频模式：如果面板已显示则关闭，否则重新打开面板
    if (chatInputRef.value?.isCameraPanelVisible()) {
      chatInputRef.value?.closeCameraPanel()
      handleVideoToggle()
    } else {
      chatInputRef.value?.openCameraPanel()
    }
  } else {
    // 未开启音视频模式：开启并弹出面板
    handleVideoToggle()
    chatInputRef.value?.openCameraPanel()
  }
}

/**
 * 打开语音设置弹窗（右键菜单）
 */
const handleVoiceSettings = () => {
  voiceSettingsRef.value?.open()
}

const {
  chatMode,
  selectedAgent,
  selectedLlmModel,
  selectedModelType,
  filteredModels,
  messages,
  isLoading,
  currentConversationId,
  currentConversationTitle,
  conversations,
  enabledAgents,
  toolPolicies,
  workspaceIsActive,
  workspaceDirName,
  workspaceFileTree,
  workspaceIsLoading,
  kbList,
  selectedKb,
  selectedKbInfo,
  topN,
  similarityThresh,
  isMessageStreaming,
  voiceEnabled,
  ttsStatus,
  videoEnabled,
  s2sEnabled,
  handleModeChange,
  handleLlmModelChange,
  handleModelTypeChange,
  handleAgentChange,
  handleKbChange,
  handleSendMessage,
  handleSelectConversation,
  handleDeleteConversation,
  handleNewConversation,
  handleStopGeneration,
  handleWorkspaceSelect,
  handleWorkspaceClear,
  handleWorkspaceRefresh,
  handleFileClick,
  handleVideoToggle,
  handleS2sToggle,
  handleFileUpload,
  getModelName,
  getAgentName,
  getKbName,
  getEmptyTitle,
  getEmptyDescription,
  init,
} = useChat()

onMounted(() => {
  init()
})
</script>

<style lang="scss" scoped>
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.header-info {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    background: linear-gradient(135deg, #03B8CF 0%, #0199AD 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.header-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.header-voice-video {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
  padding-right: 12px;
  border-right: 1px solid var(--border-color, #e8e8e8);
}

.av-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-tertiary, #999);

  &:hover {
    background: var(--bg-tertiary, #f5f5f5);
    color: var(--primary-color, #409eff);
  }

  &.active {
    color: var(--primary-color, #409eff);
  }
}

.av-trigger-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary, #999);
  border: 2px solid var(--white, #fff);
  transition: all 0.2s ease;

  &.active {
    background: #67c23a;
    box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
  }
}

.model-tag,
.agent-tag,
.kb-tag,
.workspace-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 20px;
}

.mcp-tag {
  background: linear-gradient(135deg, #fff3e6 0%, #ffe8cc 100%);
  color: #f59e0b;
}

.specified-tag {
  background: #e6fafc;
  color: var(--primary-color);
}

.agent-tag {
  background: #f0f9eb;
  color: #67c23a;
}

.kb-tag {
  background: #fdf6ec;
  color: #e6a23c;
}

.workspace-tag {
  background: #e8f4fd;
  color: #409eff;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px;
}

.messages-wrapper {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;

  h3 {
    margin-top: 20px;
    font-size: 20px;
    font-weight: 500;
    color: #666;
  }

  p {
    margin-top: 8px;
    font-size: 14px;
  }
}
</style>
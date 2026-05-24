<template>
  <AppShell>
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
              </div>
            </div>
          </template>
          <template #actions>
            <div v-if="chatMode === 'chat' && selectedAgent" class="mode-switch">
              <span class="switch-label">调试模式</span>
              <el-switch
                :model-value="debugMode"
                @change="handleDebugModeChange"
                active-color="#13ce66"
                inactive-color="#ff4949"
              />
            </div>
            <div v-if="chatMode === 'chat'" class="mode-switch">
              <span class="switch-label">思考模式</span>
              <el-switch
                :model-value="enableThinkingMode"
                @change="handleThinkingModeChange"
                active-color="#ff9800"
                inactive-color="#dcdfe6"
              />
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
            />
            <div v-if="messages.length === 0" class="empty-state">
              <el-icon :size="80" color="#ddd"><ChatDotRound /></el-icon>
              <h3>{{ getEmptyTitle() }}</h3>
              <p>{{ getEmptyDescription() }}</p>
            </div>
          </div>
        </div>

        <ChatInput
          :is-loading="isLoading"
          :mode="chatMode"
          :agents="enabledAgents"
          :workspace-is-active="workspaceIsActive"
          :workspace-dir-name="workspaceDirName"
          :models="models"
          :selected-llm-model="selectedLlmModel"
          @send="handleSendMessage"
          @stop="handleStopGeneration"
          @mode-change="handleModeChange"
          @agent-change="handleAgentChange"
          @workspace-select="handleWorkspaceSelect"
          @workspace-clear="handleWorkspaceClear"
          @llm-model-change="handleLlmModelChange"
        />
      </div>
    </template>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Plus, ChatDotRound, Cpu, Star, User, ChatLineRound } from '@element-plus/icons-vue'
import AppShell from '../../components/layout/AppShell.vue'
import AppHeader from '../../components/layout/AppHeader.vue'
import ThemeToggle from '../../components/common/ThemeToggle.vue'
import ChatSidebar from './components/ChatSidebar.vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { useChat } from '../../composables/useChat'

const {
  chatMode,
  selectedAgent,
  selectedLlmModel,
  messages,
  messagesRef,
  isLoading,
  currentConversationId,
  currentConversationTitle,
  conversations,
  models,
  enabledAgents,
  toolPolicies,
  debugMode,
  enableThinkingMode,
  workspaceIsActive,
  workspaceDirName,
  kbList,
  selectedKb,
  selectedKbInfo,
  topN,
  similarityThresh,
  isMessageStreaming,
  handleModeChange,
  handleLlmModelChange,
  handleAgentChange,
  handleKbChange,
  handleSendMessage,
  handleSelectConversation,
  handleDeleteConversation,
  handleNewConversation,
  handleStopGeneration,
  handleDebugModeChange,
  handleThinkingModeChange,
  handleWorkspaceSelect,
  handleWorkspaceClear,
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

.model-tag,
.agent-tag,
.kb-tag {
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

.mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 13px;
  color: #606266;
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

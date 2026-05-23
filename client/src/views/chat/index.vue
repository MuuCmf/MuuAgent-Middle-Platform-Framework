<template>
  <div class="chat-view">
    <div class="sidebar">
      <!-- LLM模型选择器 -->
      <div class="model-selector-section">
        <div class="section-header">
          <span class="section-title">LLM模型</span>
          <span class="section-badge">
            {{ selectedLlmModel === 'mcp-llm' ? '自动调度' : '指定模型' }}
          </span>
        </div>
        <ModelSelector
          :model-code="selectedLlmModel"
          :models="chatStore.models"
          @change="handleLlmModelChange"
        />
      </div>

      <!-- RAG知识库选择 -->
      <div v-if="chatMode === 'rag' || chatMode === 'retrieval'" class="kb-selector-section">
        <div class="section-header">
          <span class="section-title">知识库</span>
        </div>
        <div class="kb-selector">
          <el-select
            v-model="selectedKb"
            placeholder="请选择知识库"
            style="width: 100%"
            @change="handleKbChange"
          >
            <el-option
              v-for="kb in kbList"
              :key="kb.kbId"
              :label="kb.kbName"
              :value="kb.kbId"
            />
          </el-select>

          <div v-if="selectedKbInfo" class="kb-info">
            <div class="info-item">
              <span class="info-label">检索方式：</span>
              <span>{{ selectedKbInfo.retrievalMethod === 'bm25' ? 'BM25' : '向量检索' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">文档数量：</span>
              <span>{{ selectedKbInfo.documentCount || 0 }}</span>
            </div>
          </div>

          <div class="retrieval-params">
            <div class="param-item">
              <span class="param-label">返回数量 (TopN)</span>
              <el-input-number
                v-model="topN"
                :min="1"
                :max="20"
                :step="1"
                style="width: 100%"
              />
            </div>
            <div class="param-item">
              <span class="param-label">相似度阈值</span>
              <el-slider
                v-model="similarityThresh"
                :min="0"
                :max="1"
                :step="0.1"
                show-input
                :show-input-controls="false"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 客户端工具权限配置 -->
      <div v-if="chatMode === 'chat' && toolPolicies.length > 0" class="tool-policy-section">
        <div class="section-header">
          <span class="section-title">工具权限</span>
          <span class="section-badge">{{ toolPolicies.length }} 个模块</span>
        </div>
        <ToolPolicyPanel :policies="toolPolicies" />
      </div>

      <!-- 会话列表 -->
      <ConversationList
        v-if="chatMode === 'chat' || chatMode === 'rag'"
        :conversations="chatStore.conversations"
        :current-id="chatStore.currentConversationId"
        @select="handleSelectConversation"
        @delete="handleDeleteConversation"
        @new="handleNewConversation"
      />
    </div>

    <div class="main-content">
      <div class="chat-header">
        <div class="header-left">
          <h2>{{ chatStore.currentConversationTitle }}</h2>
          <div class="header-subtitle">
            <span v-if="selectedLlmModel === 'mcp-llm'" class="model-tag mcp-tag">
              <el-icon :size="14"><Star /></el-icon>
              MCP智能调度
            </span>
            <span v-else class="model-tag specified-tag">
              <el-icon :size="14"><Cpu /></el-icon>
              {{ getModelName(selectedLlmModel) }}
            </span>
            <span v-if="selectedAgent && chatMode === 'chat'" class="agent-tag">
              <el-icon :size="14"><User /></el-icon>
              {{ getAgentName(selectedAgent) }}
            </span>
            <span v-if="selectedKb && (chatMode === 'rag' || chatMode === 'retrieval')" class="kb-tag">
              <el-icon :size="14"><ChatLineRound /></el-icon>
              {{ getKbName(selectedKb) }}
            </span>
          </div>
        </div>
        <div class="header-actions">
          <div v-if="chatMode === 'chat' && selectedAgent" class="debug-mode-switch">
            <span class="debug-label">调试模式</span>
            <el-switch
              v-model="chatStore.debugMode"
              @change="handleDebugModeChange"
              active-color="#13ce66"
              inactive-color="#ff4949"
            />
          </div>
          <div v-if="chatMode === 'chat'" class="thinking-mode-switch">
            <span class="thinking-label">思考模式</span>
            <el-switch
              v-model="chatStore.enableThinkingMode"
              @change="handleThinkingModeChange"
              active-color="#ff9800"
              inactive-color="#dcdfe6"
            />
          </div>
          <el-button
            v-if="chatStore.currentConversationId"
            type="primary"
            @click="handleNewConversation"
          >
            <el-icon><Plus /></el-icon>
            新对话
          </el-button>
        </div>
      </div>

      <div class="messages-container" ref="messagesRef">
        <div class="messages-wrapper">
          <ChatMessage
            v-for="(message, index) in chatStore.messages"
            :key="index"
            :message="message"
            :is-streaming="isMessageStreaming(index)"
          />
          <div v-if="chatStore.messages.length === 0" class="empty-state">
            <el-icon :size="80" color="#ddd"><ChatDotRound /></el-icon>
            <h3>{{ getEmptyTitle() }}</h3>
            <p>{{ getEmptyDescription() }}</p>
          </div>
        </div>
      </div>

      <ChatInput
        :is-loading="chatStore.isLoading"
        :mode="chatMode"
        :agents="enabledAgents"
        :workspace-is-active="chatStore.workspaceIsActive"
        :workspace-dir-name="chatStore.workspaceDirName"
        @send="handleSendMessage"
        @stop="chatStore.stopGeneration"
        @mode-change="handleModeChangeFromInput"
        @agent-change="handleAgentChange"
        @workspace-select="handleWorkspaceSelect"
        @workspace-clear="handleWorkspaceClear"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, ref, watch, computed } from 'vue'
import { Plus, ChatDotRound, Cpu, Star, User, ChatLineRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../../stores/chat'
import { kbApi, type KbInfo } from '../../api/kb'
import { retrievalApi, type RetrievalItem } from '../../api/retrieval'
import { conversationApi } from '../../api/conversation'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ModelSelector from './components/ModelSelector.vue'
import ConversationList from './components/ConversationList.vue'
import ToolPolicyPanel from './components/ToolPolicyPanel.vue'
import { clientToolRouter } from '../../executor/client-tool-router'

const chatStore = useChatStore()
const messagesRef = ref<HTMLElement>()

const chatMode = ref<'chat' | 'rag' | 'retrieval'>('chat')
const kbList = ref<KbInfo[]>([])
const selectedKb = ref<string>('')
const selectedAgent = ref<string>('')
const selectedLlmModel = ref<string>('mcp-llm')
const topN = ref(5)
const similarityThresh = ref(0.7)

const selectedKbInfo = computed(() => {
  return kbList.value.find(kb => kb.kbId === selectedKb.value)
})

const enabledAgents = computed(() => {
  return chatStore.agents.filter(a => a.status === true)
})

const toolPolicies = computed(() => {
  return clientToolRouter.getAllPolicies()
})

const isMessageStreaming = (index: number): boolean => {
  const messages = chatStore.messages
  if (!chatStore.isLoading) return false
  if (index !== messages.length - 1) return false
  return messages[index].role === 'assistant'
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

const loadKbList = async () => {
  try {
    const res = await kbApi.getList()
    kbList.value = res.data || []
  } catch (error) {
    console.error('加载知识库列表失败:', error)
  }
}

const handleModeChange = async (mode: 'chat' | 'rag' | 'retrieval') => {
  chatMode.value = mode
  chatStore.clearMessages()
  chatStore.currentConversationId = null
  chatStore.conversations = []

  if (mode !== 'chat' && kbList.value.length === 0) {
    await loadKbList()
  }

  if (mode === 'rag') {
    await loadRagConversations()
  } else if (mode === 'chat') {
    await chatStore.loadConversations()
  }
}

const handleModeChangeFromInput = (mode: 'chat' | 'rag' | 'retrieval') => {
  handleModeChange(mode)
}

const loadRagConversations = async () => {
  try {
    const params: any = {
      conversationType: 'kb-rag',
      pageSize: 20,
    }
    if (selectedKb.value) {
      params.targetId = selectedKb.value
    }
    const response = await conversationApi.getList(params)
    chatStore.conversations = response.data.list || []
  } catch (error) {
    console.error('加载RAG会话列表失败:', error)
  }
}

const handleKbChange = async () => {
  chatStore.clearMessages()
  if (chatMode.value === 'rag') {
    await loadRagConversations()
  }
}

const handleLlmModelChange = (modelCode: string) => {
  selectedLlmModel.value = modelCode
  chatStore.setLlmModel(modelCode)
}

const handleAgentChange = async (agentId: string) => {
  selectedAgent.value = agentId
  chatStore.setAgent(agentId)
  chatStore.clearMessages()
  chatStore.currentConversationId = null
  chatStore.selectedType = agentId ? 'agent' : 'model'
  await chatStore.loadConversations()
}

const handleSendMessage = async (content: string) => {
  if (chatMode.value === 'chat') {
    await handleChatMessage(content)
  } else if (chatMode.value === 'rag') {
    await handleRagChat(content)
  } else if (chatMode.value === 'retrieval') {
    await handleRetrieval(content)
  }
  scrollToBottom()
}

const handleChatMessage = async (content: string) => {
  chatStore.selectedType = selectedAgent.value ? 'agent' : 'model'
  chatStore.selectedAgent = selectedAgent.value
  chatStore.selectedLlmModel = selectedLlmModel.value
  await chatStore.sendMessage(content)
}

const handleRagChat = async (query: string) => {
  if (!selectedKb.value) {
    ElMessage.warning('请先选择知识库')
    return
  }

  chatStore.isLoading = true

  const userMessage = { role: 'user' as const, content: query }
  chatStore.messages.push(userMessage)

  const assistantMessage = {
    role: 'assistant' as const,
    content: '',
    type: 'rag' as const,
    sources: []
  }
  chatStore.messages.push(assistantMessage)
  const assistantIndex = chatStore.messages.length - 1

  try {
    const modelCode = selectedLlmModel.value === 'mcp-llm' ? undefined : selectedLlmModel.value
    
    await retrievalApi.ragChatStream(
      {
        kbId: selectedKb.value,
        query,
        topN: topN.value,
        similarityThresh: similarityThresh.value,
        conversationId: chatStore.currentConversationId || undefined,
        modelCode,
      },
      {
        onMessage: (content: string) => {
          // 前端处理 [THINKING] 和 [ANSWER] 标记
          const msg = chatStore.messages[assistantIndex]
          
          // 如果还没有检测到标记，先追加内容
          msg.content += content
          
          // 检查是否需要分割思考内容和回答内容
          const newThinkingIndex = msg.content.indexOf('[THINKING]')
          const newAnswerIndex = msg.content.indexOf('[ANSWER]')
          
          // 如果检测到了 [THINKING] 和 [ANSWER]，进行分割
          if (newThinkingIndex !== -1 && newAnswerIndex !== -1 && newAnswerIndex > newThinkingIndex) {
            // 提取思考内容：[THINKING] 和 [ANSWER] 之间的内容
            const thinkingContent = msg.content
              .substring(newThinkingIndex + 10, newAnswerIndex)
              .trim()
            
            // 提取回答内容：[ANSWER] 之后的内容
            const answerContent = msg.content
              .substring(newAnswerIndex + 8)
              .trim()
            
            // 提取 [THINKING] 之前的内容（如果有）
            const beforeThinking = msg.content
              .substring(0, newThinkingIndex)
              .trim()
            
            // 更新消息
            msg.thinkingContent = thinkingContent
            msg.content = beforeThinking + (beforeThinking && answerContent ? '\n\n' : '') + answerContent
          }
          
          scrollToBottom()
        },
        onError: (error: Error) => {
          chatStore.messages[assistantIndex].content = '错误: ' + error.message
          ElMessage.error('RAG问答失败: ' + error.message)
          chatStore.isLoading = false
        },
        onComplete: (sources?: RetrievalItem[]) => {
          if (sources && sources.length > 0) {
            chatStore.messages[assistantIndex].sources = sources
          }
          chatStore.isLoading = false
          loadRagConversations()
        },
        onConversationId: (conversationId: string) => {
          chatStore.currentConversationId = conversationId
        }
      }
    )
  } catch (error: any) {
    chatStore.messages[assistantIndex].content = '错误: ' + error.message
    ElMessage.error('RAG问答失败')
    chatStore.isLoading = false
  }
}

const handleRetrieval = async (query: string) => {
  if (!selectedKb.value) {
    ElMessage.warning('请先选择知识库')
    return
  }

  chatStore.isLoading = true

  const userMessage = { role: 'user' as const, content: query }
  chatStore.messages.push(userMessage)

  try {
    const res = await retrievalApi.retrieval({
      kbId: selectedKb.value,
      query,
      topN: topN.value,
      similarityThresh: similarityThresh.value
    })

    const results = res.data?.list || []
    chatStore.messages.push({
      role: 'assistant',
      content: '',
      type: 'retrieval',
      results
    })
  } catch (error: any) {
    const errorMsg = '检索失败: ' + (error.response?.data?.message || error.message)
    chatStore.messages.push({ role: 'assistant', content: errorMsg })
    ElMessage.error(errorMsg)
  } finally {
    chatStore.isLoading = false
  }
}

const handleSelectConversation = async (conversationId: string) => {
  try {
    const response = await conversationApi.getDetail(conversationId)
    const conversation = response.data.conversation
    const rawMessages = response.data.messages || []

    chatStore.currentConversationId = conversation.id
    chatStore.messages = rawMessages

    if (conversation.conversationType === 'kb-rag') {
      chatMode.value = 'rag'
      selectedKb.value = conversation.targetId
      if (kbList.value.length === 0) {
        await loadKbList()
      }
    } else if (conversation.conversationType === 'agent') {
      chatMode.value = 'chat'
      chatStore.selectedType = 'agent'
      selectedAgent.value = conversation.targetId || ''
      chatStore.selectedAgent = selectedAgent.value
    } else {
      chatMode.value = 'chat'
      chatStore.selectedType = 'model'
      selectedAgent.value = ''
      chatStore.selectedAgent = ''
      // 更新模型选择为会话对应的模型
      if (conversation.targetId) {
        // 直接使用后端返回的 targetId，前端与后端保持一致
        const modelCode = conversation.targetId
        selectedLlmModel.value = modelCode
        chatStore.selectedLlmModel = modelCode
      }
    }

    scrollToBottom()
  } catch (error) {
    console.error('加载会话失败:', error)
  }
}

const handleDeleteConversation = async (conversationId: string) => {
  try {
    await chatStore.deleteConversation(conversationId)
    if (chatMode.value === 'rag') {
      await loadRagConversations()
    }
    ElMessage.success('会话已删除')
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleNewConversation = () => {
  chatStore.newConversation()
}

const handleDebugModeChange = (value: boolean) => {
  ElMessage.success(value ? '已开启调试模式，将显示推理过程' : '已关闭调试模式')
}

const handleThinkingModeChange = (value: boolean) => {
  ElMessage.success(value ? '已开启思考模式，模型将输出思考过程' : '已关闭思考模式')
}

const handleWorkspaceSelect = async () => {
  try {
    await chatStore.workspaceSelectDirectory()
    ElMessage.success(`已选择工作目录: ${chatStore.workspaceDirName}`)
  } catch (e: any) {
    if (e.name === 'AbortError') return
    ElMessage.error('选择工作目录失败: ' + (e.message || '未知错误'))
  }
}

const handleWorkspaceClear = () => {
  chatStore.workspaceClear()
  ElMessage.success('已清除工作目录')
}

const getModelName = (modelCode: string): string => {
  const model = chatStore.models.find(m => m.code === modelCode)
  return model?.name || modelCode
}

const getAgentName = (agentId: string): string => {
  const agent = chatStore.agents.find(a => a.id === agentId)
  return agent?.name || agentId
}

const getKbName = (kbId: string): string => {
  const kb = kbList.value.find(k => k.kbId === kbId)
  return kb?.kbName || kbId
}

const getEmptyTitle = (): string => {
  switch (chatMode.value) {
    case 'chat': return '开始新的对话'
    case 'rag': return '开始RAG问答'
    case 'retrieval': return '开始向量检索'
    default: return '开始新的对话'
  }
}

const getEmptyDescription = (): string => {
  switch (chatMode.value) {
    case 'chat': return '输入消息开始与AI助手对话'
    case 'rag': return '选择知识库后输入问题，基于文档内容进行问答'
    case 'retrieval': return '选择知识库后输入关键词进行向量检索'
    default: return '输入消息开始与AI助手对话'
  }
}

watch(() => chatStore.messages.length, () => {
  scrollToBottom()
})

onMounted(async () => {
  await chatStore.loadModels()
  await chatStore.loadAgents()
  await chatStore.loadConversations()
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.model-selector-section,
.agent-selector-section,
.kb-selector-section,
.tool-policy-section {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.section-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #e8f4fd;
  color: #20a0ff;
  border-radius: 10px;
}

.agent-selector {
  .agent-option {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .agent-desc {
    font-size: 12px;
    color: #999;
    margin-left: auto;
  }
}

.kb-selector {
  .kb-info {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 10px;
    margin-top: 10px;
  }
  .info-item {
    display: flex;
    font-size: 12px;
    margin-bottom: 6px;
    &:last-child {
      margin-bottom: 0;
    }
  }
  .info-label {
    color: #999;
    width: 70px;
    flex-shrink: 0;
  }
  .info-item span:last-child {
    color: #333;
  }
  .retrieval-params {
    margin-top: 10px;
  }
  .param-item {
    margin-bottom: 10px;
    &:last-child {
      margin-bottom: 0;
    }
  }
  .param-label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  flex: 1;
}

.chat-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-subtitle {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.model-tag,
.agent-tag,
.kb-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 16px;
}

.model-tag.mcp-tag {
  background: #fff3e6;
  color: #f59e0b;
}

.model-tag.specified-tag {
  background: #e8f4fd;
  color: #20a0ff;
}

.agent-tag {
  background: #f0f5ff;
  color: #667eea;
}

.kb-tag {
  background: #f0fff4;
  color: #67c23a;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.debug-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f5f7fa;
  border-radius: 20px;
  transition: all 0.3s;
}

.debug-mode-switch:hover {
  background: #e8e8e8;
}

.debug-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.thinking-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff3e0;
  border-radius: 20px;
  transition: all 0.3s;
}

.thinking-mode-switch:hover {
  background: #ffe0b2;
}

.thinking-label {
  font-size: 14px;
  font-weight: 500;
  color: #e65100;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.messages-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-state h3 {
  margin: 24px 0 12px;
  font-size: 24px;
  color: #333;
}

.empty-state p {
  margin: 0;
  color: #999;
  font-size: 16px;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

:deep(.el-select__wrapper) {
  border-radius: 8px;
}

:deep(.el-select__wrapper:hover) {
  border-color: #667eea;
}

:deep(.el-select__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}
</style>
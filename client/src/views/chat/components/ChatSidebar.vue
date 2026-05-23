<template>
  <div class="chat-sidebar">
    <!-- 侧边栏导航 -->
    <div class="sidebar-nav">
      <div
        v-for="nav in navItems"
        :key="nav.key"
        :class="['nav-item', { active: activePanel === nav.key }]"
        :title="nav.label"
        @click="activePanel = nav.key"
      >
        <el-icon :size="18"><component :is="nav.icon" /></el-icon>
      </div>
      <div class="nav-spacer" />
      <ThemeToggle />
    </div>

    <!-- 侧边栏面板内容 -->
    <div class="sidebar-panel">
      <!-- 会话面板 -->
      <div v-show="activePanel === 'conversations'" class="panel-content">
        <div class="panel-header">
          <span class="panel-title">会话</span>
          <el-button type="primary" size="small" @click="emit('newConversation')" circle>
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
        <ConversationList
          v-if="chatMode === 'chat' || chatMode === 'rag'"
          :conversations="conversations"
          :current-id="currentConversationId"
          @select="emit('selectConversation', $event)"
          @delete="emit('deleteConversation', $event)"
          @new="emit('newConversation')"
        />
      </div>

      <!-- 工具面板 -->
      <div v-show="activePanel === 'tools'" class="panel-content">
        <div class="panel-header">
          <span class="panel-title">工具与权限</span>
        </div>
        <div class="panel-body">
          <ToolPolicyPanel v-if="toolPolicies.length > 0" :policies="toolPolicies" />
          <div v-else class="empty-panel">
            <el-icon :size="40" color="#ddd"><SetUp /></el-icon>
            <p>暂无工具权限策略</p>
            <p class="empty-hint">开始智能体对话后将自动加载</p>
          </div>
        </div>
      </div>

      <!-- RAG知识库面板 -->
      <div v-show="activePanel === 'knowledge'" class="panel-content">
        <div class="panel-header">
          <span class="panel-title">知识库</span>
        </div>
        <div class="panel-body">
          <div class="kb-selector">
            <el-select
              :model-value="selectedKb"
              placeholder="请选择知识库"
              style="width: 100%"
              @change="handleKbSelect"
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
                  :model-value="topN"
                  :min="1"
                  :max="20"
                  :step="1"
                  style="width: 100%"
                  @change="emit('topNChange', $event)"
                />
              </div>
              <div class="param-item">
                <span class="param-label">相似度阈值</span>
                <el-slider
                  :model-value="similarityThresh"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  show-input
                  :show-input-controls="false"
                  @change="emit('similarityThreshChange', $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Component } from 'vue'
import { Plus, ChatLineRound, SetUp, Reading } from '@element-plus/icons-vue'
import ConversationList from './ConversationList.vue'
import ToolPolicyPanel from './ToolPolicyPanel.vue'
import ThemeToggle from '../../../components/common/ThemeToggle.vue'
import type { KbInfo } from '../../../services/KbService'
import type { ClientToolModulePolicy } from '../../../executor/types'
import type { Conversation } from '../../../services/ConversationService'

/**
 * 侧边栏面板类型
 */
type SidebarPanel = 'conversations' | 'tools' | 'knowledge'

interface Props {
  /** 聊天模式 */
  chatMode: 'chat' | 'rag' | 'retrieval'
  /** 选中的智能体 */
  selectedAgent: string
  /** 选中的知识库ID */
  selectedKb: string
  /** 知识库列表 */
  kbList: KbInfo[]
  /** 选中的知识库信息 */
  selectedKbInfo?: KbInfo
  /** 返回数量 */
  topN: number
  /** 相似度阈值 */
  similarityThresh: number
  /** 工具权限策略 */
  toolPolicies: ClientToolModulePolicy[]
  /** 会话列表 */
  conversations: Conversation[]
  /** 当前会话ID */
  currentConversationId: string | null
  /** 智能体列表 */
  agents: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 智能体变更 */
  agentChange: [value: string]
  /** 知识库变更 */
  kbChange: []
  /** 知识库选择 */
  kbSelect: [value: string]
  /** TopN变更 */
  topNChange: [value: number]
  /** 相似度阈值变更 */
  similarityThreshChange: [value: number]
  /** 选择会话 */
  selectConversation: [id: string]
  /** 删除会话 */
  deleteConversation: [id: string]
  /** 新建会话 */
  newConversation: []
}>()

/** 当前激活的面板 */
const activePanel = ref<SidebarPanel>('conversations')

/**
 * 导航项配置
 */
const navItems: { key: SidebarPanel; label: string; icon: Component }[] = [
  { key: 'conversations', label: '会话', icon: ChatLineRound },
  { key: 'tools', label: '工具', icon: SetUp },
  { key: 'knowledge', label: '知识库', icon: Reading },
]

/**
 * 根据聊天模式自动切换面板
 */
watch(() => props.chatMode, (mode) => {
  if (mode === 'rag' || mode === 'retrieval') {
    activePanel.value = 'knowledge'
  } else {
    activePanel.value = 'conversations'
  }
})

/**
 * 处理知识库选择
 * @param kbId 知识库ID
 */
const handleKbSelect = (kbId: string) => {
  emit('kbSelect', kbId)
  emit('kbChange')
}
</script>

<style scoped>
.chat-sidebar {
  display: flex;
  height: 100%;
  background: #fafbfc;
}

.sidebar-nav {
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 4px;
  background: #f0f2f5;
  border-right: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.nav-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #909399;
}

.nav-item:hover {
  background: #e8eaed;
  color: #606266;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.35);
}

.nav-spacer {
  flex: 1;
}

.sidebar-panel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #c0c4cc;
}

.empty-panel p {
  margin-top: 12px;
  font-size: 14px;
}

.empty-panel .empty-hint {
  font-size: 12px;
  color: #dcdfe6;
  margin-top: 4px;
}

.kb-selector .kb-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;
}

.kb-selector .info-item {
  display: flex;
  font-size: 12px;
  margin-bottom: 6px;
}

.kb-selector .info-item:last-child {
  margin-bottom: 0;
}

.kb-selector .info-label {
  color: #999;
  width: 70px;
  flex-shrink: 0;
}

.kb-selector .info-item span:last-child {
  color: #333;
}

.kb-selector .retrieval-params {
  margin-top: 10px;
}

.kb-selector .param-item {
  margin-bottom: 10px;
}

.kb-selector .param-item:last-child {
  margin-bottom: 0;
}

.kb-selector .param-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}
</style>

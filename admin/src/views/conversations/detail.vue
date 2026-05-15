<template>
  <div class="conversation-detail-page" v-loading="loading">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="handleBack" text class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <div class="title-group">
          <h1 class="page-title">{{ conversation?.title || '未命名会话' }}</h1>
          <el-tag
            v-if="conversation"
            :type="getStatusTagType(conversation.status)"
            size="small"
            class="status-tag"
            effect="dark"
            round
          >
            {{ getStatusLabel(conversation.status) }}
          </el-tag>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </div>

    <template v-if="conversation">
      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">基本信息</span>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="会话ID">
            {{ conversation.id }}
          </el-descriptions-item>
          <el-descriptions-item label="会话类型">
            <el-tag :type="getTypeTagType(conversation.conversationType)" size="small">
              {{ getTypeLabel(conversation.conversationType) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="目标ID">
            {{ conversation.targetId }}
          </el-descriptions-item>
          <el-descriptions-item label="消息数量">
            {{ conversation.messageCount || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="用户ID">
            {{ conversation.uid || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(conversation.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(conversation.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后消息时间">
            {{ formatDate(conversation.lastMessageAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">对话记录</span>
            <el-button @click="handleGenerateTitle" :loading="generatingTitle" size="small">
              <el-icon><MagicStick /></el-icon>
              生成标题
            </el-button>
          </div>
        </template>

        <div v-if="messages && messages.length > 0" class="messages-list">
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-item"
            :class="`message-${message.role}`"
          >
            <div class="message-header">
              <el-tag :type="getRoleTagType(message.role)" size="small">
                {{ getRoleLabel(message.role) }}
              </el-tag>
              <span class="message-time">{{ formatDate(message.createdAt) }}</span>
            </div>
            <div class="message-content">
              <div class="content-text">{{ message.content }}</div>
              <div v-if="message.tokenCount" class="message-meta">
                Token数: {{ message.tokenCount }}
              </div>
            </div>
          </div>
        </div>

        <el-empty v-else description="暂无对话记录" />
      </el-card>
    </template>

    <ConversationEditDialog
      v-model="editDialogVisible"
      :conversation="conversation"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, MagicStick } from '@element-plus/icons-vue'
import { useConversationStore } from '@/stores/conversation'
import {
  ConversationType,
  ConversationStatus,
} from '@/api/conversation'
import ConversationEditDialog from './components/ConversationEditDialog.vue'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const conversationStore = useConversationStore()

const editDialogVisible = ref(false)
const generatingTitle = ref(false)

const conversation = computed(() => conversationStore.currentConversation)
const messages = computed(() => conversationStore.messages)
const loading = computed(() => conversationStore.loading)

/**
 * 获取会话详情
 */
const fetchConversationDetail = async () => {
  const id = route.params.id as string
  if (!id) {
    ElMessage.error('会话ID不存在')
    router.push('/conversations')
    return
  }

  try {
    await conversationStore.fetchConversationDetail(id, 100)
  } catch (error) {
    ElMessage.error('获取会话详情失败')
    router.push('/conversations')
  }
}

/**
 * 返回列表页
 */
const handleBack = () => {
  router.push('/conversations')
}

/**
 * 编辑会话
 */
const handleEdit = () => {
  editDialogVisible.value = true
}

/**
 * 删除会话
 */
const handleDelete = async () => {
  if (!conversation.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除会话"${conversation.value.title || '未命名会话'}"吗？删除后将无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await conversationStore.deleteConversation(conversation.value.id)
    ElMessage.success('删除成功')
    router.push('/conversations')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

/**
 * 生成标题
 */
const handleGenerateTitle = async () => {
  if (!conversation.value) return

  generatingTitle.value = true
  try {
    const title = await conversationStore.generateTitle(conversation.value.id)
    ElMessage.success(`标题已生成: ${title}`)
  } catch (error) {
    ElMessage.error('生成标题失败')
  } finally {
    generatingTitle.value = false
  }
}

/**
 * 编辑成功回调
 */
const handleEditSuccess = () => {
  fetchConversationDetail()
}

/**
 * 获取会话类型标签
 * @param type 会话类型
 * @returns 类型标签文本
 */
const getTypeLabel = (type?: ConversationType) => {
  if (!type) return '-'
  const labels: Record<string, string> = {
    [ConversationType.AGENT]: '智能体',
    [ConversationType.MODEL]: '模型',
    [ConversationType.KB_RAG]: '知识库',
  }
  return labels[type] || type
}

/**
 * 获取会话类型标签样式
 * @param type 会话类型
 * @returns 标签类型
 */
const getTypeTagType = (type?: ConversationType) => {
  if (!type) return 'info'
  const types: Record<string, string> = {
    [ConversationType.AGENT]: 'primary',
    [ConversationType.MODEL]: 'success',
    [ConversationType.KB_RAG]: 'warning',
  }
  return types[type] || 'info'
}

/**
 * 获取会话状态标签
 * @param status 会话状态
 * @returns 状态标签文本
 */
const getStatusLabel = (status?: ConversationStatus) => {
  if (!status) return '-'
  const labels: Record<string, string> = {
    [ConversationStatus.ACTIVE]: '活跃',
    [ConversationStatus.ARCHIVED]: '已归档',
    [ConversationStatus.DELETED]: '已删除',
  }
  return labels[status] || status
}

/**
 * 获取会话状态标签样式
 * @param status 会话状态
 * @returns 标签类型
 */
const getStatusTagType = (status?: ConversationStatus) => {
  if (!status) return 'info'
  const types: Record<string, string> = {
    [ConversationStatus.ACTIVE]: 'success',
    [ConversationStatus.ARCHIVED]: 'info',
    [ConversationStatus.DELETED]: 'danger',
  }
  return types[status] || 'info'
}

/**
 * 获取消息角色标签
 * @param role 角色
 * @returns 角色标签文本
 */
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    user: '用户',
    assistant: '助手',
    system: '系统',
    tool: '工具',
  }
  return labels[role] || role
}

/**
 * 获取消息角色标签样式
 * @param role 角色
 * @returns 标签类型
 */
const getRoleTagType = (role: string) => {
  const types: Record<string, string> = {
    user: 'primary',
    assistant: 'success',
    system: 'info',
    tool: 'warning',
  }
  return types[role] || ''
}

onMounted(() => {
  fetchConversationDetail()
})
</script>

<style scoped lang="scss">
.conversation-detail-page {
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  font-weight: 500;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: #1e1b4b;
}

.status-tag {
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.detail-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.detail-card :deep(.el-card__header) {
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 12px 12px 0 0;
}

.detail-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #1e1b4b;
}

.detail-card :deep(.el-descriptions__label) {
  font-weight: 500;
  color: #6b7280;
}

.detail-card :deep(.el-descriptions__content) {
  color: #1e1b4b;
}

.messages-list {
  .message-item {
    padding: 16px;
    margin-bottom: 16px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #0891b2;

    &:last-child {
      margin-bottom: 0;
    }

    &.message-user {
      border-left-color: #0891b2;
    }

    &.message-assistant {
      border-left-color: #22c55e;
    }

    &.message-system {
      border-left-color: #64748b;
    }

    &.message-tool {
      border-left-color: #f59e0b;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .message-time {
        font-size: 12px;
        color: #64748b;
      }
    }

    .message-content {
      .content-text {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
        color: #1e1b4b;
      }

      .message-meta {
        margin-top: 8px;
        font-size: 12px;
        color: #64748b;
      }
    }
  }
}
</style>
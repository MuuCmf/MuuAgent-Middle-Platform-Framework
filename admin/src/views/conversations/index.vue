<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('conversation.title') }}</h1>
      <p class="page-description">{{ $t('conversation.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 {{ $t('conversation.managementTip') }}</div>
      <p>{{ $t('conversation.managementDesc') }}</p>
    </div>

    <div class="card">
      <div class="filter-section">
        <el-select
          v-model="filters.conversationType"
          :placeholder="$t('conversation.conversationType')"
          clearable
          style="width: 150px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="option in conversationTypeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-select
          v-model="filters.status"
          :placeholder="$t('conversation.conversationStatus')"
          clearable
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="option in conversationStatusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-input
          v-model="searchKeyword"
          :placeholder="$t('conversation.searchConversationTitle')"
          clearable
          style="width: 240px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" @click="handleSearch">{{ $t('common.query') }}</el-button>
        <el-button @click="handleReset">{{ $t('common.reset') }}</el-button>
      </div>

      <el-table
        :data="conversations"
        stripe
        v-loading="loading"
        @row-click="handleRowClick"
        style="cursor: pointer"
      >
        <el-table-column prop="title" :label="$t('conversation.conversationTitleColumn')" min-width="200">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px">
              <span>{{ row.title || $t('conversation.unnamedConversation') }}</span>
              <el-tag v-if="!row.title" type="info" size="small">{{ $t('conversation.unnamed') }}</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="conversationType" :label="$t('conversation.conversationType')" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.conversationType)" size="small">
              {{ getTypeLabel(row.conversationType) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="targetId" :label="$t('conversation.targetId')" width="180" show-overflow-tooltip />

        <el-table-column prop="messageCount" :label="$t('conversation.messageCount')" width="100" align="center" />

        <el-table-column prop="status" :label="$t('conversation.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="lastMessageAt" :label="$t('conversation.lastMessageTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.lastMessageAt) }}
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" :label="$t('conversation.createdAt')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="$t('conversation.operation')" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="handleViewDetail(row)"
            >
              {{ $t('conversation.viewDetail') }}
            </el-button>
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="handleEdit(row)"
            >
              {{ $t('conversation.edit') }}
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              @click.stop="handleDelete(row)"
            >
              {{ $t('conversation.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <ConversationEditDialog
      v-model="editDialogVisible"
      :conversation="editingConversation"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useConversationStore } from '@/stores/conversation'
import {
  ConversationType,
  ConversationStatus,
  Conversation as ConversationInterface,
} from '@/api/conversation'
import ConversationEditDialog from './components/ConversationEditDialog.vue'
import { formatDate } from '@/utils/format'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const conversationTypeOptions = [
  { label: t('conversation.agentConversation'), value: 'AGENT' as const },
  { label: t('conversation.modelConversation'), value: 'MODEL' as const },
  { label: t('conversation.kbConversation'), value: 'KB_RAG' as const },
]

const conversationStatusOptions = [
  { label: t('conversation.active'), value: 'active' as const },
  { label: t('conversation.archived'), value: 'archived' as const },
  { label: t('conversation.deleted'), value: 'deleted' as const },
]

const router = useRouter()
const conversationStore = useConversationStore()

const filters = ref<{
  conversationType?: ConversationType
  status?: ConversationStatus
}>({})

const searchKeyword = ref('')
const pagination = ref({
  page: 1,
  pageSize: 20,
})

const editDialogVisible = ref(false)
const editingConversation = ref<ConversationInterface | null>(null)

const conversations = computed(() => conversationStore.conversations || [])
const total = computed(() => conversationStore.total || 0)
const loading = computed(() => conversationStore.loading || false)

/**
 * 获取会话列表
 */
const fetchConversations = async () => {
  try {
    await conversationStore.fetchConversations({
      ...filters.value,
      ...pagination.value,
    })
  } catch (error) {
    ElMessage.error(t('conversation.getConversationListFailed'))
  }
}

/**
 * 筛选条件变更
 */
const handleFilterChange = () => {
  pagination.value.page = 1
  fetchConversations()
}

/**
 * 搜索
 */
const handleSearch = () => {
  pagination.value.page = 1
  fetchConversations()
}

/**
 * 重置筛选条件
 */
const handleReset = () => {
  filters.value = {}
  searchKeyword.value = ''
  pagination.value.page = 1
  fetchConversations()
}

/**
 * 页码变更
 */
const handlePageChange = () => {
  fetchConversations()
}

/**
 * 每页条数变更
 */
const handlePageSizeChange = () => {
  pagination.value.page = 1
  fetchConversations()
}

/**
 * 查看会话详情
 * @param row 会话数据
 */
const handleViewDetail = (row: ConversationInterface) => {
  router.push(`/conversations/detail/${row.id}`)
}

/**
 * 行点击
 * @param row 会话数据
 */
const handleRowClick = (row: ConversationInterface) => {
  handleViewDetail(row)
}

/**
 * 编辑会话
 * @param row 会话数据
 */
const handleEdit = (row: ConversationInterface) => {
  editingConversation.value = row
  editDialogVisible.value = true
}

/**
 * 删除会话
 * @param row 会话数据
 */
const handleDelete = async (row: ConversationInterface) => {
  try {
    await ElMessageBox.confirm(
      t('conversation.deleteConfirm', { title: row.title || t('conversation.unnamedConversation') }),
      t('conversation.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await conversationStore.deleteConversation(row.id)
    ElMessage.success(t('conversation.deleteSuccess'))
    fetchConversations()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('conversation.deleteFailed'))
    }
  }
}

/**
 * 编辑成功回调
 */
const handleEditSuccess = () => {
  fetchConversations()
}

/**
 * 获取会话类型标签
 * @param type 会话类型
 * @returns 类型标签文本
 */
const getTypeLabel = (type: ConversationType) => {
  const labels: Record<string, string> = {
    [ConversationType.AGENT]: t('conversation.agent'),
    [ConversationType.MODEL]: t('conversation.model'),
    [ConversationType.KB_RAG]: t('conversation.knowledgeBase'),
  }
  return labels[type] || type
}

/**
 * 获取会话类型标签样式
 * @param type 会话类型
 * @returns 标签类型
 */
const getTypeTagType = (type: ConversationType) => {
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
const getStatusLabel = (status: ConversationStatus) => {
  const labels: Record<string, string> = {
    [ConversationStatus.ACTIVE]: t('conversation.active'),
    [ConversationStatus.ARCHIVED]: t('conversation.archived'),
    [ConversationStatus.DELETED]: t('conversation.deleted'),
  }
  return labels[status] || status
}

/**
 * 获取会话状态标签样式
 * @param status 会话状态
 * @returns 标签类型
 */
const getStatusTagType = (status: ConversationStatus) => {
  const types: Record<string, string> = {
    [ConversationStatus.ACTIVE]: 'success',
    [ConversationStatus.ARCHIVED]: 'info',
    [ConversationStatus.DELETED]: 'danger',
  }
  return types[status] || 'info'
}

onMounted(() => {
  fetchConversations()
})
</script>

<style lang="scss" scoped>
.filter-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.pagination-section {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
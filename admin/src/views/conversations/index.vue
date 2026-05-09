<template>
  <div class="conversation-list">
    <el-card class="list-card" shadow="never">
      <template #header>
        <div class="card-header">
          <h2 class="title">会话管理</h2>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建会话
          </el-button>
        </div>
      </template>

      <div class="filters">
        <el-select
          v-model="filters.conversationType"
          placeholder="会话类型"
          clearable
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
          placeholder="会话状态"
          clearable
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
          placeholder="搜索会话标题"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-table
        :data="conversations"
        v-loading="loading"
        stripe
        @row-click="handleRowClick"
        class="conversation-table"
      >
        <el-table-column prop="title" label="标题" min-width="200">
          <template #default="{ row }">
            <div class="title-cell">
              <span>{{ row.title || '未命名会话' }}</span>
              <el-tag v-if="!row.title" type="info" size="small">未命名</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="conversationType" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.conversationType)">
              {{ getTypeLabel(row.conversationType) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="targetId" label="目标ID" width="180" show-overflow-tooltip />

        <el-table-column prop="messageCount" label="消息数" width="100" align="center" />

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="lastMessageAt" label="最后消息时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.lastMessageAt) }}
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              @click.stop="handleViewDetail(row)"
            >
              查看详情
            </el-button>
            <el-button
              type="primary"
              link
              @click.stop="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              link
              @click.stop="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
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
    </el-card>

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
import { Plus, Search } from '@element-plus/icons-vue'
import { useConversationStore } from '@/stores/conversation'
import {
  ConversationType,
  ConversationStatus,
  Conversation as ConversationInterface,
} from '@/api/conversation'
import ConversationEditDialog from './components/ConversationEditDialog.vue'
import { formatDate } from '@/utils/format'

const conversationTypeOptions = [
  { label: '智能体对话', value: 'AGENT' as const },
  { label: '模型对话', value: 'MODEL' as const },
  { label: '知识库对话', value: 'KB_RAG' as const },
]

const conversationStatusOptions = [
  { label: '活跃', value: 'active' as const },
  { label: '已归档', value: 'archived' as const },
  { label: '已删除', value: 'deleted' as const },
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

const fetchConversations = async () => {
  try {
    await conversationStore.fetchConversations({
      ...filters.value,
      ...pagination.value,
    })
  } catch (error) {
    ElMessage.error('获取会话列表失败')
  }
}

const handleFilterChange = () => {
  pagination.value.page = 1
  fetchConversations()
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchConversations()
}

const handlePageChange = () => {
  fetchConversations()
}

const handlePageSizeChange = () => {
  pagination.value.page = 1
  fetchConversations()
}

const handleCreate = () => {
  editingConversation.value = null
  editDialogVisible.value = true
}

const handleViewDetail = (row: ConversationInterface) => {
  router.push(`/conversations/detail/${row.id}`)
}

const handleRowClick = (row: ConversationInterface) => {
  handleViewDetail(row)
}

const handleEdit = (row: ConversationInterface) => {
  editingConversation.value = row
  editDialogVisible.value = true
}

const handleDelete = async (row: ConversationInterface) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除会话"${row.title || '未命名会话'}"吗？删除后将无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await conversationStore.deleteConversation(row.id)
    ElMessage.success('删除成功')
    fetchConversations()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleEditSuccess = () => {
  fetchConversations()
}

const getTypeLabel = (type: ConversationType) => {
  const labels: Record<string, string> = {
    [ConversationType.AGENT]: '智能体',
    [ConversationType.MODEL]: '模型',
    [ConversationType.KB_RAG]: '知识库',
  }
  return labels[type] || type
}

const getTypeTagType = (type: ConversationType) => {
  const types: Record<string, string> = {
    [ConversationType.AGENT]: 'primary',
    [ConversationType.MODEL]: 'success',
    [ConversationType.KB_RAG]: 'warning',
  }
  return types[type] || 'info'
}

const getStatusLabel = (status: ConversationStatus) => {
  const labels: Record<string, string> = {
    [ConversationStatus.ACTIVE]: '活跃',
    [ConversationStatus.ARCHIVED]: '已归档',
    [ConversationStatus.DELETED]: '已删除',
  }
  return labels[status] || status
}

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

<style scoped lang="scss">
.conversation-list {
  
  .list-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #164e63;
      }
    }

    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;

      .el-select {
        width: 150px;
      }

      .el-input {
        width: 300px;
      }
    }

    .conversation-table {
      .title-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .pagination {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
  }
}
</style>

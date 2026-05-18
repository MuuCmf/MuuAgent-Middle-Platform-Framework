<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">MCP Server 管理</h1>
      <p class="page-description">管理 MCP Server 配置，支持工具发现、连接测试和健康检查</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 MCP Server 说明</div>
      <p>MCP (Model Control Plane) Server 是提供工具能力的外部服务。配置后，智能体可以调用这些工具完成特定任务。支持 HTTP 协议连接，可配置超时、重试和健康检查。</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>MCP Server 列表</span>
        <div class="card-actions">
          <el-button @click="handleHealthCheckAll" :loading="healthCheckLoading">
            <el-icon><Monitor /></el-icon>
            健康检查
          </el-button>
          <el-button @click="handleRefreshCache">
            <el-icon><Refresh /></el-icon>
            刷新缓存
          </el-button>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建 Server
          </el-button>
        </div>
      </div>

      <div class="filter-section">
        <el-select
          v-model="searchForm.enabled"
          placeholder="状态"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
        <el-select
          v-model="searchForm.healthStatus"
          placeholder="健康状态"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option label="健康" value="healthy" />
          <el-option label="不健康" value="unhealthy" />
          <el-option label="未知" value="unknown" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="serverList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="displayName" label="显示名称" min-width="120">
          <template #default="{ row }">
            {{ row.displayName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="url" label="URL" min-width="200" show-overflow-tooltip />
        <el-table-column label="工具" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.tools?.length" type="info" size="small">
              {{ row.tools.length }} 个
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="健康状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getHealthTagType(row.healthStatus)"
              size="small"
            >
              {{ getHealthLabel(row.healthStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后同步" width="160">
          <template #default="{ row }">
            {{ row.lastSyncAt ? formatDate(row.lastSyncAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleTestConnection(row)">
              测试
            </el-button>
            <el-button link type="primary" size="small" @click="handleSyncTools(row)">
              同步
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <McpServerEditDrawer
      v-model="editDrawerVisible"
      :server="currentServer"
      :mode="editMode"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Monitor,
  Refresh,
} from '@element-plus/icons-vue'
import { mcpServerApi, type McpServer } from '@/api/mcp-server'
import { formatDate } from '@/utils/format'
import McpServerEditDrawer from './components/McpServerEditDrawer.vue'

const loading = ref(false)
const healthCheckLoading = ref(false)
const serverList = ref<McpServer[]>([])
const editDrawerVisible = ref(false)
const currentServer = ref<McpServer | null>(null)
const editMode = ref<'create' | 'edit'>('create')

const searchForm = reactive({
  enabled: undefined as boolean | undefined,
  healthStatus: undefined as string | undefined,
})

const getHealthTagType = (status?: string): 'success' | 'danger' | 'info' => {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'unhealthy':
      return 'danger'
    default:
      return 'info'
  }
}

const getHealthLabel = (status?: string): string => {
  switch (status) {
    case 'healthy':
      return '健康'
    case 'unhealthy':
      return '不健康'
    default:
      return '未知'
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const { data } = await mcpServerApi.getList(searchForm)
    serverList.value = data.data
  } catch (error) {
    console.error('获取 MCP Server 列表失败:', error)
    ElMessage.error('获取列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchList()
}

const handleReset = () => {
  searchForm.enabled = undefined
  searchForm.healthStatus = undefined
  fetchList()
}

const handleCreate = () => {
  currentServer.value = null
  editMode.value = 'create'
  editDrawerVisible.value = true
}

const handleEdit = (row: McpServer) => {
  currentServer.value = row
  editMode.value = 'edit'
  editDrawerVisible.value = true
}

const handleEditSuccess = () => {
  fetchList()
}

const handleTestConnection = async (row: McpServer) => {
  try {
    ElMessage.info(`正在测试 ${row.displayName || row.name} 连接...`)
    const { data } = await mcpServerApi.testConnectionById(row.id)
    if (data.data.success) {
      ElMessage.success(`连接成功，延迟: ${data.data.latency}ms`)
    } else {
      ElMessage.error(`连接失败: ${data.data.message}`)
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    ElMessage.error('测试连接失败')
  }
}

const handleSyncTools = async (row: McpServer) => {
  try {
    ElMessage.info(`正在同步 ${row.displayName || row.name} 工具...`)
    const { data } = await mcpServerApi.syncTools(row.id)
    ElMessage.success(`同步成功，发现 ${data.data.toolCount} 个工具`)
    fetchList()
  } catch (error) {
    console.error('同步工具失败:', error)
    ElMessage.error('同步工具失败')
  }
}

const handleHealthCheckAll = async () => {
  healthCheckLoading.value = true
  try {
    ElMessage.info('正在进行健康检查...')
    const { data } = await mcpServerApi.healthCheckAll()
    const results = data.data
    const healthy = Object.values(results).filter(r => r.healthy).length
    const total = Object.keys(results).length
    ElMessage.success(`健康检查完成: ${healthy}/${total} 个服务健康`)
    fetchList()
  } catch (error) {
    console.error('健康检查失败:', error)
    ElMessage.error('健康检查失败')
  } finally {
    healthCheckLoading.value = false
  }
}

const handleRefreshCache = async () => {
  try {
    await mcpServerApi.refreshCache()
    ElMessage.success('缓存已刷新')
  } catch (error) {
    console.error('刷新缓存失败:', error)
    ElMessage.error('刷新缓存失败')
  }
}

const handleDelete = async (row: McpServer) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 MCP Server "${row.displayName || row.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await mcpServerApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">



.help-tip {
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.help-tip-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-color-primary);
}

.help-tip p {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.card {
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 10px;
}

.filter-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
</style>

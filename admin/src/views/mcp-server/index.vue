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
          <el-button @click="handleImport">
            <el-icon><Upload /></el-icon>
            导入配置
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
        <el-select
          v-model="searchForm.transport"
          placeholder="传输协议"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option label="HTTP" value="http" />
          <el-option label="SSE" value="sse" />
          <el-option label="STDIO" value="stdio" />
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
        <el-table-column label="协议" width="80">
          <template #default="{ row }">
            <el-tag :type="getTransportTagType(row.transport)" size="small">
              {{ row.transport?.toUpperCase() || 'HTTP' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="连接信息" min-width="200">
          <template #default="{ row }">
            <template v-if="row.transport === 'stdio'">
              <span class="connection-info">{{ row.command }} {{ (row.args || []).join(' ') }}</span>
            </template>
            <template v-else>
              <span class="connection-info">{{ row.url || '-' }}</span>
            </template>
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="180" fixed="right" align="right">
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

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="searchForm.page"
          v-model:page-size="searchForm.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <McpServerEditDrawer
      v-model="editDrawerVisible"
      :server="currentServer"
      :mode="editMode"
      @success="handleEditSuccess"
    />

    <el-dialog
      v-model="importDialogVisible"
      title="导入 MCP Server 配置"
      width="600px"
    >
      <div class="import-tip">
        <p>支持 Claude Desktop 配置格式，直接粘贴 JSON 即可导入：</p>
        <pre class="import-example">{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxx" }
    }
  }
}</pre>
      </div>
      <el-input
        v-model="importJsonText"
        type="textarea"
        :rows="12"
        placeholder="粘贴 Claude Desktop 配置 JSON..."
      />
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImportSubmit" :loading="importLoading">
          导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importResultVisible"
      title="导入结果"
      width="500px"
    >
      <div class="import-result-summary">
        <el-tag type="info">总数: {{ importResult?.total || 0 }}</el-tag>
        <el-tag type="success">成功: {{ importResult?.success || 0 }}</el-tag>
        <el-tag type="danger">失败: {{ importResult?.failed || 0 }}</el-tag>
      </div>
      <el-table :data="importResult?.results || []" max-height="300">
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error" label="错误信息" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="importResultVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Monitor,
  Refresh,
  Upload,
} from '@element-plus/icons-vue'
import { mcpServerApi, type McpServer, type McpTransport, type ImportResult } from '@/api/mcp-server'
import { formatDate } from '@/utils/format'
import McpServerEditDrawer from './components/McpServerEditDrawer.vue'

const loading = ref(false)
const healthCheckLoading = ref(false)
const serverList = ref<McpServer[]>([])
const total = ref(0)
const editDrawerVisible = ref(false)
const currentServer = ref<McpServer | null>(null)
const editMode = ref<'create' | 'edit'>('create')
const importDialogVisible = ref(false)
const importJsonText = ref('')
const importLoading = ref(false)
const importResultVisible = ref(false)
const importResult = ref<ImportResult | null>(null)

const searchForm = reactive({
  enabled: undefined as boolean | undefined,
  healthStatus: undefined as string | undefined,
  transport: undefined as McpTransport | undefined,
  page: 1,
  pageSize: 10,
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

const getTransportTagType = (transport?: string): 'primary' | 'success' | 'warning' => {
  switch (transport) {
    case 'stdio':
      return 'warning'
    case 'sse':
      return 'success'
    default:
      return 'primary'
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
    serverList.value = data.data.list
    total.value = data.data.total
  } catch (error) {
    console.error('获取 MCP Server 列表失败:', error)
    ElMessage.error('获取列表失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  searchForm.page = page
  fetchList()
}

const handleSizeChange = (size: number) => {
  searchForm.pageSize = size
  searchForm.page = 1
  fetchList()
}

const handleSearch = () => {
  searchForm.page = 1
  fetchList()
}

const handleReset = () => {
  searchForm.enabled = undefined
  searchForm.healthStatus = undefined
  searchForm.transport = undefined
  searchForm.page = 1
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

const handleImport = () => {
  importJsonText.value = ''
  importDialogVisible.value = true
}

const handleImportSubmit = async () => {
  if (!importJsonText.value.trim()) {
    ElMessage.warning('请粘贴配置 JSON')
    return
  }

  try {
    const parsed = JSON.parse(importJsonText.value)
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      ElMessage.error('JSON 格式错误：需要包含 mcpServers 字段')
      return
    }

    importLoading.value = true
    const { data } = await mcpServerApi.importServers(parsed)
    importResult.value = data.data
    importDialogVisible.value = false
    importResultVisible.value = true
    fetchList()

    if (data.data.success > 0) {
      ElMessage.success(`成功导入 ${data.data.success} 个 MCP Server`)
    }
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('JSON 解析失败，请检查格式')
  } finally {
    importLoading.value = false
  }
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
.connection-info {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.help-tip {
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.import-tip {
  margin-bottom: 16px;

  p {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .import-example {
    background: var(--el-fill-color-light);
    border-radius: 4px;
    padding: 12px;
    font-size: 12px;
    overflow-x: auto;
    margin: 0;
  }
}

.import-result-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
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

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>

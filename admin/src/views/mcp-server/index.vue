<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('mcp.title') }}</h1>
      <p class="page-description">{{ $t('mcp.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ $t('mcp.helpTip.title') }}</div>
      <ul>
        <li>{{ $t('mcp.helpTip.content') }}</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">
        <div class="card-actions">
          <el-button type="primary" @click="handleCreate">
            <el-icon>
              <Plus />
            </el-icon>
            {{ $t('mcp.actions.createServer') }}
          </el-button>
          <el-button @click="handleHealthCheckAll" :loading="healthCheckLoading">
            <el-icon>
              <Monitor />
            </el-icon>
            {{ $t('mcp.actions.healthCheck') }}
          </el-button>
          <el-button @click="handleRefreshCache">
            <el-icon>
              <Refresh />
            </el-icon>
            {{ $t('mcp.actions.refreshCache') }}
          </el-button>
          <el-button @click="handleImport">
            <el-icon>
              <Upload />
            </el-icon>
            {{ $t('mcp.actions.importConfig') }}
          </el-button>
        </div>
      </div>

      <div class="filter-section">
        <el-select v-model="searchForm.enabled" :placeholder="$t('mcp.filter.status')" clearable style="width: 120px"
          @change="handleSearch">
          <el-option :label="$t('mcp.filter.enabled')" :value="true" />
          <el-option :label="$t('mcp.filter.disabled')" :value="false" />
        </el-select>
        <el-select v-model="searchForm.healthStatus" :placeholder="$t('mcp.filter.healthStatus')" clearable
          style="width: 120px" @change="handleSearch">
          <el-option :label="$t('mcp.filter.healthy')" value="healthy" />
          <el-option :label="$t('mcp.filter.unhealthy')" value="unhealthy" />
          <el-option :label="$t('mcp.filter.unknown')" value="unknown" />
        </el-select>
        <el-select v-model="searchForm.transport" :placeholder="$t('mcp.filter.transport')" clearable style="width: 120px"
          @change="handleSearch">
          <el-option label="HTTP" value="http" />
          <el-option label="SSE" value="sse" />
          <el-option label="STDIO" value="stdio" />
        </el-select>
        <el-button type="primary" @click="handleSearch">{{ $t('mcp.actions.query') }}</el-button>
        <el-button @click="handleReset">{{ $t('mcp.actions.reset') }}</el-button>
      </div>

      <el-table v-loading="loading" :data="serverList" stripe style="width: 100%">
        <el-table-column prop="name" :label="$t('mcp.table.name')" min-width="120" />
        <el-table-column prop="displayName" :label="$t('mcp.table.displayName')" min-width="120">
          <template #default="{ row }">
            {{ row.displayName || '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.protocol')" width="80">
          <template #default="{ row }">
            <el-tag :type="getTransportTagType(row.transport)" size="small">
              {{ row.transport?.toUpperCase() || 'HTTP' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.connectionInfo')" min-width="200">
          <template #default="{ row }">
            <template v-if="row.transport === 'stdio'">
              <span class="connection-info">{{ row.command }} {{ (row.args || []).join(' ') }}</span>
            </template>
            <template v-else>
              <span class="connection-info">{{ row.url || '-' }}</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.tools')" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.tools?.length" type="info" size="small">
              {{ $t('mcp.table.toolsCount', { count: row.tools.length }) }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.healthStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="getHealthTagType(row.healthStatus)" size="small">
              {{ getHealthLabel(row.healthStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? $t('mcp.filter.enabled') : $t('mcp.filter.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.lastSync')" width="160">
          <template #default="{ row }">
            {{ row.lastSyncAt ? formatDate(row.lastSyncAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.createdAt')" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('mcp.table.operations')" width="180" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleTestConnection(row)">
              {{ $t('mcp.actions.test') }}
            </el-button>
            <el-button link type="primary" size="small" @click="handleSyncTools(row)">
              {{ $t('mcp.actions.sync') }}
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              {{ $t('mcp.actions.edit') }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              {{ $t('mcp.actions.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="searchForm.page" v-model:page-size="searchForm.pageSize"
          :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

    <McpServerEditDrawer v-model="editDrawerVisible" :server="currentServer" :mode="editMode"
      @success="handleEditSuccess" />

    <el-dialog v-model="importDialogVisible" :title="$t('mcp.importDialog.title')" width="600px">
      <div class="import-tip">
        <p>{{ $t('mcp.importDialog.tip') }}</p>
        <pre class="import-example">
{
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
}
    </pre>
      </div>
      <el-input v-model="importJsonText" type="textarea" :rows="12" :placeholder="$t('mcp.importDialog.placeholder')" />
      <template #footer>
        <el-button @click="importDialogVisible = false">{{ $t('mcp.actions.cancel') }}</el-button>
        <el-button type="primary" @click="handleImportSubmit" :loading="importLoading">
          {{ $t('mcp.importDialog.submit') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importResultVisible" :title="$t('mcp.importResult.title')" width="500px">
      <div class="import-result-summary">
        <el-tag type="info">{{ $t('mcp.importResult.total', { total: importResult?.total || 0 }) }}</el-tag>
        <el-tag type="success">{{ $t('mcp.importResult.success', { success: importResult?.success || 0 }) }}</el-tag>
        <el-tag type="danger">{{ $t('mcp.importResult.failed', { failed: importResult?.failed || 0 }) }}</el-tag>
      </div>
      <el-table :data="importResult?.results || []" max-height="300">
        <el-table-column prop="name" :label="$t('mcp.importResult.name')" width="150" />
        <el-table-column :label="$t('mcp.importResult.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? $t('mcp.importResult.successTag') : $t('mcp.importResult.failedTag') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error" :label="$t('mcp.importResult.error')" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="importResultVisible = false">{{ $t('mcp.actions.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

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
      return t('mcp.filter.healthy')
    case 'unhealthy':
      return t('mcp.filter.unhealthy')
    default:
      return t('mcp.filter.unknown')
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
    ElMessage.error(t('mcp.messages.fetchListFailed'))
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
    ElMessage.warning(t('mcp.messages.pasteConfigJson'))
    return
  }

  try {
    const parsed = JSON.parse(importJsonText.value)
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      ElMessage.error(t('mcp.messages.jsonFormatError'))
      return
    }

    importLoading.value = true
    const { data } = await mcpServerApi.importServers(parsed)
    importResult.value = data.data
    importDialogVisible.value = false
    importResultVisible.value = true
    fetchList()

    if (data.data.success > 0) {
      ElMessage.success(t('mcp.messages.importSuccess', { count: data.data.success }))
    }
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error(t('mcp.messages.jsonParseError'))
  } finally {
    importLoading.value = false
  }
}

const handleTestConnection = async (row: McpServer) => {
  try {
    ElMessage.info(t('mcp.messages.testingConnection', { name: row.displayName || row.name }))
    const { data } = await mcpServerApi.testConnectionById(row.id)
    if (data.data.success) {
      ElMessage.success(t('mcp.messages.connectionSuccess', { latency: data.data.latency }))
    } else {
      ElMessage.error(t('mcp.messages.connectionFailed', { message: data.data.message }))
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    ElMessage.error(t('mcp.messages.testConnectionFailed'))
  }
}

const handleSyncTools = async (row: McpServer) => {
  try {
    ElMessage.info(t('mcp.messages.syncingTools', { name: row.displayName || row.name }))
    const { data } = await mcpServerApi.syncTools(row.id)
    ElMessage.success(t('mcp.messages.syncSuccess', { count: data.data.toolCount }))
    fetchList()
  } catch (error) {
    console.error('同步工具失败:', error)
    ElMessage.error(t('mcp.messages.syncFailed'))
  }
}

const handleHealthCheckAll = async () => {
  healthCheckLoading.value = true
  try {
    ElMessage.info(t('mcp.messages.healthChecking'))
    const { data } = await mcpServerApi.healthCheckAll()
    const results = data.data
    const healthy = Object.values(results).filter(r => r.healthy).length
    const total = Object.keys(results).length
    ElMessage.success(t('mcp.messages.healthCheckComplete', { healthy, total }))
    fetchList()
  } catch (error) {
    console.error('健康检查失败:', error)
    ElMessage.error(t('mcp.messages.healthCheckFailed'))
  } finally {
    healthCheckLoading.value = false
  }
}

const handleRefreshCache = async () => {
  try {
    await mcpServerApi.refreshCache()
    ElMessage.success(t('mcp.messages.cacheRefreshed'))
  } catch (error) {
    console.error('刷新缓存失败:', error)
    ElMessage.error(t('mcp.messages.cacheRefreshFailed'))
  }
}

const handleDelete = async (row: McpServer) => {
  try {
    await ElMessageBox.confirm(
      t('mcp.messages.deleteConfirm', { name: row.displayName || row.name }),
      t('mcp.messages.deleteConfirmTitle'),
      {
        confirmButtonText: t('mcp.actions.confirm'),
        cancelButtonText: t('mcp.actions.cancel'),
        type: 'warning',
      }
    )
    await mcpServerApi.delete(row.id)
    ElMessage.success(t('mcp.messages.deleteSuccess'))
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error(t('mcp.messages.deleteFailed'))
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

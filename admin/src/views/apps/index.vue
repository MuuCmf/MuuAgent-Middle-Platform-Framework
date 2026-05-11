<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">应用管理</h1>
      <p class="page-description">管理多租户应用，配置资源权限和配额限制</p>
    </div>

    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索应用名称/标识"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" style="width: 100px">
            <el-option label="启用" value="true" />
            <el-option label="禁用" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>应用列表</span>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建应用
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="appList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="应用名称" min-width="150" />
        <el-table-column prop="code" label="应用标识" min-width="120" />
        <el-table-column label="API Key" min-width="200">
          <template #default="{ row }">
            <div class="key-cell">
              <span class="key-text">{{ row.apiKey }}</span>
              <el-button
                link
                type="primary"
                @click="copyToClipboard(row.apiKey)"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="配额" min-width="120">
          <template #default="{ row }">
            <div class="quota-cell">
              <span>QPS: {{ row.qpsLimit }}</span>
              <span>日限: {{ row.dailyLimit }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="OAuth" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enableOAuth ? 'success' : 'info'" size="small">
              {{ row.enableOAuth ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">
              详情
            </el-button>
            <el-button link type="primary" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="warning" @click="handleResetSecret(row)">
              重置密钥
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <AppEditDrawer
      v-model="editDrawerVisible"
      :app="currentApp"
      :mode="editMode"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  Plus,
  CopyDocument,
} from '@element-plus/icons-vue'
import { appApi, type App, type AppQuery } from '@/api/app'
import AppEditDrawer from './components/AppEditDrawer.vue'

const router = useRouter()
const loading = ref(false)
const appList = ref<App[]>([])
const editDrawerVisible = ref(false)
const currentApp = ref<App | null>(null)
const editMode = ref<'create' | 'edit'>('create')

const searchForm = reactive({
  keyword: '',
  status: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const fetchApps = async () => {
  loading.value = true
  try {
    const query: AppQuery = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (searchForm.keyword) {
      query.keyword = searchForm.keyword
    }
    if (searchForm.status === 'true') {
      query.status = true
    } else if (searchForm.status === 'false') {
      query.status = false
    }
    const { data } = await appApi.getList(query)
    appList.value = data.data.list
    pagination.total = data.data.total
  } catch (error) {
    console.error('获取应用列表失败:', error)
    ElMessage.error('获取应用列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchApps()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  pagination.page = 1
  fetchApps()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  fetchApps()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchApps()
}

const handleCreate = () => {
  currentApp.value = null
  editMode.value = 'create'
  editDrawerVisible.value = true
}

const handleEdit = (app: App) => {
  currentApp.value = app
  editMode.value = 'edit'
  editDrawerVisible.value = true
}

const handleView = (app: App) => {
  router.push(`/apps/detail/${app.id}`)
}

const handleResetSecret = async (app: App) => {
  try {
    await ElMessageBox.confirm(
      '重置密钥后，旧密钥将立即失效，确定要重置吗？',
      '重置密钥',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const { data } = await appApi.resetSecret(app.id, false)
    ElMessage.success('密钥重置成功')
    ElMessageBox.alert(
      `新的Secret Key: ${data.data.secretKey}`,
      '请保存新密钥',
      {
        confirmButtonText: '我已保存',
        type: 'warning',
      }
    )
    fetchApps()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密钥失败:', error)
      ElMessage.error('重置密钥失败')
    }
  }
}

const handleDelete = async (app: App) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除应用 "${app.name}" 吗？此操作不可恢复。`,
      '删除应用',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error',
      }
    )

    await appApi.delete(app.id)
    ElMessage.success('删除成功')
    fetchApps()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除应用失败:', error)
      ElMessage.error('删除应用失败')
    }
  }
}

const handleEditSuccess = () => {
  fetchApps()
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchApps()
})
</script>

<style scoped lang="scss">


.search-card {
  margin-bottom: 20px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.table-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-text {
  font-family: monospace;
  font-size: 12px;
}

.quota-cell {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #606266;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

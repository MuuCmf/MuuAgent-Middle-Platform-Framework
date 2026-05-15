<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">应用管理</h1>
      <p class="page-description">管理多租户应用，配置资源权限和配额限制</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 应用管理说明</div>
      <p>应用是AI中台的租户单元，每个应用拥有独立的API Key、配额限制和OAuth配置。支持创建、编辑、删除以及密钥重置等操作。</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>应用列表</span>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新建应用
        </el-button>
      </div>

      <div class="filter-section">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索应用名称/标识"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 100px"
          @change="handleSearch"
        >
          <el-option label="启用" value="true" />
          <el-option label="禁用" value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

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
                size="small"
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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button link type="warning" size="small" @click="handleResetSecret(row)">
              重置密钥
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
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
    </div>

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

/**
 * 获取应用列表
 */
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

/**
 * 搜索
 */
const handleSearch = () => {
  pagination.page = 1
  fetchApps()
}

/**
 * 重置筛选条件
 */
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  pagination.page = 1
  fetchApps()
}

/**
 * 每页条数变更
 * @param size 每页条数
 */
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  fetchApps()
}

/**
 * 页码变更
 * @param page 页码
 */
const handlePageChange = (page: number) => {
  pagination.page = page
  fetchApps()
}

/**
 * 新建应用
 */
const handleCreate = () => {
  currentApp.value = null
  editMode.value = 'create'
  editDrawerVisible.value = true
}

/**
 * 编辑应用
 * @param app 应用数据
 */
const handleEdit = (app: App) => {
  currentApp.value = app
  editMode.value = 'edit'
  editDrawerVisible.value = true
}

/**
 * 查看应用详情
 * @param app 应用数据
 */
const handleView = (app: App) => {
  router.push(`/apps/detail/${app.id}`)
}

/**
 * 重置密钥
 * @param app 应用数据
 */
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

/**
 * 删除应用
 * @param app 应用数据
 */
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

/**
 * 编辑成功回调
 */
const handleEditSuccess = () => {
  fetchApps()
}

/**
 * 复制到剪贴板
 * @param text 要复制的文本
 */
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

/**
 * 格式化日期
 * @param dateStr 日期字符串
 * @returns 格式化后的日期
 */
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchApps()
})
</script>

<style scoped lang="scss">
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
</style>
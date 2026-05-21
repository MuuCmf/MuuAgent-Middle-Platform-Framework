<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('app.title') }}</h1>
      <p class="page-description">{{ $t('app.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 {{ $t('app.managementTip') }}</div>
      <ul>
        <li>{{ $t('app.managementDesc') }}</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">
        <el-button type="primary" @click="handleCreate">
          <el-icon>
            <Plus />
          </el-icon>
          {{ $t('app.createApp') }}
        </el-button>
      </div>

      <div class="filter-section">
        <el-input v-model="searchForm.keyword" :placeholder="$t('app.searchAppNameOrCode')" clearable
          style="width: 220px" @clear="handleSearch" @keyup.enter="handleSearch" />
        <el-select v-model="searchForm.status" :placeholder="$t('app.status')" clearable style="width: 100px"
          @change="handleSearch">
          <el-option :label="$t('app.enabled')" value="true" />
          <el-option :label="$t('app.disabled')" value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">{{ $t('common.query') }}</el-button>
        <el-button @click="handleReset">{{ $t('common.reset') }}</el-button>
      </div>

      <el-table v-loading="loading" :data="appList" stripe style="width: 100%">
        <el-table-column prop="name" :label="$t('app.appName')" min-width="150" />
        <el-table-column prop="code" :label="$t('app.appCode')" min-width="120" />
        <el-table-column :label="$t('app.apiKey')" min-width="200">
          <template #default="{ row }">
            <div class="key-cell">
              <span class="key-text">{{ row.apiKey }}</span>
              <el-button link type="primary" size="small" @click="copyToClipboard(row.apiKey)">
                <el-icon>
                  <CopyDocument />
                </el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('app.quota')" min-width="120">
          <template #default="{ row }">
            <div class="quota-cell">
              <span>{{ $t('app.qpsLimit') }}: {{ row.qpsLimit }}</span>
              <span>{{ $t('app.dailyLimit') }}: {{ row.dailyLimit }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('app.oauth')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enableOAuth ? 'success' : 'info'" size="small">
              {{ row.enableOAuth ? $t('app.oauthEnabled') : $t('app.oauthDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('app.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? $t('app.enabled') : $t('app.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('app.createdAt')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('app.operation')" width="240" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">
              {{ $t('app.detail') }}
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              {{ $t('app.edit') }}
            </el-button>
            <el-button link type="warning" size="small" @click="handleResetSecret(row)">
              {{ $t('app.resetSecret') }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              {{ $t('app.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

    <AppEditDrawer v-model="editDrawerVisible" :app="currentApp" :mode="editMode" @success="handleEditSuccess" />
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
    ElMessage.error(t('app.getAppListFailed'))
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
      t('app.resetSecretConfirm'),
      t('app.resetSecretTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const { data } = await appApi.resetSecret(app.id, false)
    ElMessage.success(t('app.resetSecretSuccess'))
    ElMessageBox.alert(
      `${t('app.newSecretKey')}: ${data.data.secretKey}`,
      t('app.saveNewKey'),
      {
        confirmButtonText: t('app.saved'),
        type: 'warning',
      }
    )
    fetchApps()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密钥失败:', error)
      ElMessage.error(t('app.resetSecretFailed'))
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
      t('app.deleteConfirm'),
      t('app.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'error',
      }
    )

    await appApi.delete(app.id)
    ElMessage.success(t('app.deleteSuccess'))
    fetchApps()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除应用失败:', error)
      ElMessage.error(t('app.deleteFailed'))
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
  ElMessage.success(t('app.copiedToClipboard'))
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
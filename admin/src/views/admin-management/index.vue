<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('admin.title') }}</h1>
      <p class="page-description">{{ $t('admin.description') }}</p>
    </div>

    <div class="card">
      <div class="card-title">
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          {{ $t('admin.createAdmin') }}
        </el-button>
      </div>

      <div class="filter-section">
        <el-input
          v-model="searchForm.keyword"
          :placeholder="$t('admin.searchPlaceholder')"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.role"
          :placeholder="$t('admin.role')"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option :label="$t('admin.roleAdmin')" value="admin" />
          <el-option :label="$t('admin.roleOps')" value="ops" />
          <el-option :label="$t('admin.roleRead')" value="read" />
        </el-select>
        <el-select
          v-model="searchForm.status"
          :placeholder="$t('common.status')"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option :label="$t('admin.enabled')" :value="1" />
          <el-option :label="$t('admin.disabled')" :value="0" />
        </el-select>
        <el-button type="primary" @click="handleSearch">{{ $t('common.query') }}</el-button>
        <el-button @click="handleReset">{{ $t('common.reset') }}</el-button>
      </div>

      <el-table v-loading="loading" :data="adminList" stripe style="width: 100%">
        <el-table-column prop="username" :label="$t('admin.username')" min-width="120" />
        <el-table-column prop="nickname" :label="$t('admin.nickname')" min-width="100">
          <template #default="{ row }">
            {{ row.nickname || '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('admin.role')" width="120">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)" size="small">
              {{ getRoleName(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? $t('admin.enabled') : $t('admin.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" :label="$t('admin.email')" min-width="160">
          <template #default="{ row }">
            {{ row.email || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" :label="$t('admin.phone')" min-width="120">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('admin.lastLogin')" min-width="160">
          <template #default="{ row }">
            {{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.createTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions')" width="240" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">
              {{ $t('common.edit') }}
            </el-button>
            <el-button
              v-if="row.status === 1"
              link type="warning" size="small"
              :disabled="row.isSuperAdmin"
              @click="handleToggleStatus(row, 0)"
            >
              {{ $t('admin.disable') }}
            </el-button>
            <el-button
              v-else
              link type="success" size="small"
              :disabled="row.isSuperAdmin"
              @click="handleToggleStatus(row, 1)"
            >
              {{ $t('admin.enable') }}
            </el-button>
            <el-button link type="warning" size="small" @click="handleResetPassword(row)">
              {{ $t('admin.resetPassword') }}
            </el-button>
            <el-button
              link type="danger" size="small"
              :disabled="row.isSuperAdmin"
              @click="handleDelete(row)"
            >
              {{ $t('common.delete') }}
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

    <AdminEditDrawer
      v-model="editDrawerVisible"
      :admin="currentAdmin"
      :mode="editMode"
      @success="handleEditSuccess"
    />

    <el-dialog
      v-model="resetPasswordVisible"
      :title="$t('admin.resetPasswordTitle')"
      width="450px"
    >
      <el-form
        ref="resetPasswordFormRef"
        :model="resetPasswordForm"
        :rules="resetPasswordRules"
        label-width="100px"
      >
        <el-form-item :label="$t('admin.username')">
          <span>{{ resetPasswordTarget?.username }}</span>
        </el-form-item>
        <el-form-item :label="$t('admin.newPassword')" prop="newPassword">
          <el-input
            v-model="resetPasswordForm.newPassword"
            type="password"
            :placeholder="$t('admin.pleaseInputNewPassword')"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="resetPasswordLoading" @click="handleResetPasswordSubmit">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi, type AdminUser } from '@/api/admin'
import AdminEditDrawer from './components/AdminEditDrawer.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const loading = ref(false)
const adminList = ref<AdminUser[]>([])
const editDrawerVisible = ref(false)
const currentAdmin = ref<AdminUser | null>(null)
const editMode = ref<'create' | 'edit'>('create')

const searchForm = reactive({
  keyword: '',
  role: '',
  status: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const resetPasswordVisible = ref(false)
const resetPasswordTarget = ref<AdminUser | null>(null)
const resetPasswordFormRef = ref<FormInstance>()
const resetPasswordLoading = ref(false)
const resetPasswordForm = reactive({
  newPassword: '',
})

const resetPasswordRules: FormRules = {
  newPassword: [
    { required: true, message: t('admin.pleaseInputNewPassword'), trigger: 'blur' },
    { min: 6, message: t('admin.passwordMinLength'), trigger: 'blur' },
  ],
}

/**
 * 获取管理员列表
 */
const fetchAdmins = async () => {
  loading.value = true
  try {
    const query: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (searchForm.keyword) query.keyword = searchForm.keyword
    if (searchForm.role) query.role = searchForm.role
    if (searchForm.status !== undefined && searchForm.status !== null) query.status = searchForm.status

    const { data } = await adminApi.getList(query)
    adminList.value = data.data.list
    pagination.total = data.data.total
  } catch (error) {
    console.error('获取管理员列表失败:', error)
    ElMessage.error(t('admin.getListFailed'))
  } finally {
    loading.value = false
  }
}

/**
 * 搜索
 */
const handleSearch = () => {
  pagination.page = 1
  fetchAdmins()
}

/**
 * 重置筛选条件
 */
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.role = ''
  searchForm.status = undefined
  pagination.page = 1
  fetchAdmins()
}

/**
 * 每页条数变更
 * @param size 每页条数
 */
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  fetchAdmins()
}

/**
 * 页码变更
 * @param page 页码
 */
const handlePageChange = (page: number) => {
  pagination.page = page
  fetchAdmins()
}

/**
 * 新建管理员
 */
const handleCreate = () => {
  currentAdmin.value = null
  editMode.value = 'create'
  editDrawerVisible.value = true
}

/**
 * 编辑管理员
 * @param admin 管理员数据
 */
const handleEdit = (admin: AdminUser) => {
  currentAdmin.value = admin
  editMode.value = 'edit'
  editDrawerVisible.value = true
}

/**
 * 切换管理员状态
 * @param admin 管理员数据
 * @param status 目标状态
 */
const handleToggleStatus = async (admin: AdminUser, status: number) => {
  const action = status === 1 ? t('admin.enable') : t('admin.disable')
  try {
    await ElMessageBox.confirm(
      t('admin.toggleStatusConfirm', { action, username: admin.username }),
      t('common.tip'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await adminApi.updateStatus(admin.id, status)
    ElMessage.success(t('admin.updateStatusSuccess'))
    fetchAdmins()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('更新状态失败:', error)
    }
  }
}

/**
 * 重置密码弹窗
 * @param admin 管理员数据
 */
const handleResetPassword = (admin: AdminUser) => {
  resetPasswordTarget.value = admin
  resetPasswordForm.newPassword = ''
  resetPasswordVisible.value = true
}

/**
 * 提交重置密码
 */
const handleResetPasswordSubmit = async () => {
  if (!resetPasswordFormRef.value) return
  const valid = await resetPasswordFormRef.value.validate()
  if (!valid) return

  if (!resetPasswordTarget.value) return

  resetPasswordLoading.value = true
  try {
    await adminApi.resetPassword(resetPasswordTarget.value.id, {
      newPassword: resetPasswordForm.newPassword,
    })
    ElMessage.success(t('admin.resetPasswordSuccess'))
    resetPasswordVisible.value = false
  } catch (error) {
    console.error('重置密码失败:', error)
    ElMessage.error(t('admin.resetPasswordFailed'))
  } finally {
    resetPasswordLoading.value = false
  }
}

/**
 * 删除管理员
 * @param admin 管理员数据
 */
const handleDelete = async (admin: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      t('admin.deleteConfirm', { username: admin.username }),
      t('common.tip'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'error',
      }
    )

    await adminApi.delete(admin.id)
    ElMessage.success(t('common.deleteSuccess'))
    fetchAdmins()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除管理员失败:', error)
    }
  }
}

/**
 * 编辑成功回调
 */
const handleEditSuccess = () => {
  fetchAdmins()
}

/**
 * 获取角色名称
 * @param role 角色标识
 * @returns {string} 角色名称
 */
const getRoleName = (role: string) => {
  const roleMap: Record<string, string> = {
    admin: t('admin.roleAdmin'),
    ops: t('admin.roleOps'),
    read: t('admin.roleRead'),
  }
  return roleMap[role] || role
}

/**
 * 获取角色标签类型
 * @param role 角色标识
 * @returns {string} 标签类型
 */
const getRoleTagType = (role: string) => {
  const tagTypeMap: Record<string, string> = {
    admin: 'danger',
    ops: 'warning',
    read: 'info',
  }
  return tagTypeMap[role] || 'info'
}

/**
 * 格式化日期
 * @param dateStr 日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchAdmins()
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
</style>

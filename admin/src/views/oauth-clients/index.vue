<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">🔐 OAuth 管理</h1>
      <p class="page-description">管理 OAuth 2.0 客户端和令牌，支持第三方应用接入授权</p>
    </div>

    <el-tabs v-model="activeTab" class="oauth-tabs">
      <el-tab-pane label="客户端管理" name="clients">
        <div class="card">
          <div class="card-title">
            客户端列表
            <el-tag type="info" size="small">{{ total }} 个</el-tag>
          </div>

          <div class="help-tip" style="margin-bottom: 20px;">
            <div class="help-tip-title">💡 OAuth 客户端说明</div>
            <ul>
              <li><strong>客户端ID</strong>：唯一标识符，用于 OAuth 授权请求</li>
              <li><strong>客户端密钥</strong>：用于客户端认证，需妥善保管</li>
              <li><strong>回调地址</strong>：授权成功后的跳转地址，必须完全匹配</li>
              <li><strong>权限范围</strong>：客户端可访问的资源范围</li>
            </ul>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 12px;">
            <el-input
              v-model="searchText"
              placeholder="搜索客户端名称或ID"
              style="width: 300px;"
              @keyup.enter="loadClients"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="loadClients">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
            <el-button type="primary" @click="handleCreate">
              <el-icon><Plus /></el-icon>
              创建客户端
            </el-button>
          </div>

          <el-table :data="clients" stripe v-loading="loading">
            <el-table-column prop="name" label="客户端名称" width="200" />
            <el-table-column prop="clientId" label="客户端ID" width="280">
              <template #default="{ row }">
                <el-tag type="info" size="small">{{ row.clientId }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="redirectUris" label="回调地址" min-width="250">
              <template #default="{ row }">
                <el-space wrap>
                  <el-tag v-for="uri in row.redirectUris" :key="uri" size="small" type="success">
                    {{ uri }}
                  </el-tag>
                </el-space>
              </template>
            </el-table-column>
            <el-table-column prop="scopes" label="权限范围" width="220">
              <template #default="{ row }">
                <el-space wrap>
                  <el-tooltip
                    v-for="scope in row.scopes"
                    :key="scope"
                    :content="getScopeDescription(scope)"
                    placement="top"
                  >
                    <el-tag :type="getScopeTagType(scope)" size="small">
                      {{ scope }}
                    </el-tag>
                  </el-tooltip>
                </el-space>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'danger'">
                  {{ row.status === 1 ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" align="right" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleView(row)">查看</el-button>
                <el-button size="small" @click="handleEdit(row)">编辑</el-button>
                <el-button size="small" type="warning" @click="handleResetSecret(row)">重置密钥</el-button>
                <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="total"
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="令牌管理" name="tokens">
        <div class="card">
          <div class="card-title">
            令牌列表
            <el-tag type="info" size="small">{{ tokenTotal }} 个</el-tag>
          </div>

          <div class="help-tip" style="margin-bottom: 20px;">
            <div class="help-tip-title">💡 令牌说明</div>
            <ul>
              <li><strong>访问令牌</strong>：用于访问受保护资源的凭证，有效期 2 小时</li>
              <li><strong>刷新令牌</strong>：用于获取新的访问令牌，有效期 7 天</li>
              <li><strong>权限范围</strong>：令牌可访问的资源范围</li>
              <li><strong>撤销令牌</strong>：立即失效，无法恢复</li>
            </ul>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 12px;">
            <el-select
              v-model="selectedClientId"
              placeholder="筛选客户端"
              clearable
              style="width: 300px;"
              @change="loadTokens"
            >
              <el-option
                v-for="client in clients"
                :key="client.clientId"
                :label="client.name"
                :value="client.clientId"
              />
            </el-select>
            <el-button type="primary" @click="loadTokens">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
          </div>

          <el-table :data="tokens" stripe v-loading="tokenLoading">
            <el-table-column prop="accessToken" label="访问令牌" width="220">
              <template #default="{ row }">
                <el-tag type="info" size="small">{{ row.accessToken }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="clientName" label="客户端" width="180" />
            <el-table-column prop="userId" label="用户ID" width="220">
              <template #default="{ row }">
                <el-tag size="small">{{ row.userId }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="scope" label="权限范围" width="220">
              <template #default="{ row }">
                <el-space wrap>
                  <el-tooltip
                    v-for="s in row.scope.split(' ')"
                    :key="s"
                    :content="getScopeDescription(s)"
                    placement="top"
                  >
                    <el-tag :type="getScopeTagType(s)" size="small">
                      {{ s }}
                    </el-tag>
                  </el-tooltip>
                </el-space>
              </template>
            </el-table-column>
            <el-table-column prop="expiresAt" label="过期时间" width="180">
              <template #default="{ row }">
                <div>
                  {{ formatDate(row.expiresAt) }}
                  <el-tag
                    v-if="isExpired(row.expiresAt)"
                    type="danger"
                    size="small"
                    style="margin-left: 8px;"
                  >
                    已过期
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="right" fixed="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="danger"
                  @click="handleRevoke(row.id)"
                  :disabled="isExpired(row.expiresAt)"
                >
                  撤销
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <el-pagination
              v-model:current-page="tokenCurrentPage"
              v-model:page-size="tokenPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="tokenTotal"
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <ClientEditDrawer
      v-model:visible="editDrawerVisible"
      :client="currentClient"
      @success="loadClients"
    />

    <ClientDetailDialog
      v-model:visible="detailDialogVisible"
      :client="currentClient"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { oauthApi, type OAuthClient, type OAuthToken } from '@/api/oauth'
import { getScopeDescription, getScopeTagType } from '@/constants/scope'
import ClientEditDrawer from './components/ClientEditDrawer.vue'
import ClientDetailDialog from './components/ClientDetailDialog.vue'

const activeTab = ref('clients')
const clients = ref<OAuthClient[]>([])
const tokens = ref<OAuthToken[]>([])
const loading = ref(false)
const tokenLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tokenCurrentPage = ref(1)
const tokenPageSize = ref(10)
const tokenTotal = ref(0)
const searchText = ref('')
const selectedClientId = ref('')
const editDrawerVisible = ref(false)
const detailDialogVisible = ref(false)
const currentClient = ref<OAuthClient | null>(null)

/**
 * 加载客户端列表
 */
const loadClients = async () => {
  loading.value = true
  try {
    const response = await oauthApi.getClients(currentPage.value, pageSize.value, searchText.value)
    clients.value = response.data.data.data
    total.value = response.data.data.total
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载客户端列表失败')
  } finally {
    loading.value = false
  }
}

/**
 * 加载令牌列表
 */
const loadTokens = async () => {
  tokenLoading.value = true
  try {
    const response = await oauthApi.getTokens(
      tokenCurrentPage.value,
      tokenPageSize.value,
      selectedClientId.value || undefined
    )
    tokens.value = response.data.data.data
    tokenTotal.value = response.data.data.total
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载令牌列表失败')
  } finally {
    tokenLoading.value = false
  }
}

/**
 * 创建客户端
 */
const handleCreate = () => {
  currentClient.value = null
  editDrawerVisible.value = true
}

/**
 * 查看客户端详情
 * @param client 客户端信息
 */
const handleView = (client: OAuthClient) => {
  currentClient.value = client
  detailDialogVisible.value = true
}

/**
 * 编辑客户端
 * @param client 客户端信息
 */
const handleEdit = (client: OAuthClient) => {
  currentClient.value = client
  editDrawerVisible.value = true
}

/**
 * 重置客户端密钥
 * @param client 客户端信息
 */
const handleResetSecret = async (client: OAuthClient) => {
  try {
    await ElMessageBox.confirm(
      '重置密钥后，原密钥将立即失效，确定要重置吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const response = await oauthApi.resetClientSecret(client.id)
    ElMessage.success('密钥重置成功，请妥善保管新密钥')
    
    await ElMessageBox.alert(
      `新的客户端密钥：${response.data.data.clientSecret}`,
      '密钥重置成功',
      {
        confirmButtonText: '确定',
        type: 'success',
      }
    )
    
    loadClients()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '重置密钥失败')
    }
  }
}

/**
 * 删除客户端
 * @param id 客户端ID
 */
const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '删除客户端后，所有相关令牌将失效，确定要删除吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await oauthApi.deleteClient(id)
    ElMessage.success('客户端已删除')
    loadClients()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '删除客户端失败')
    }
  }
}

/**
 * 撤销令牌
 * @param id 令牌ID
 */
const handleRevoke = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '撤销令牌后，客户端将无法继续使用该令牌访问资源，确定要撤销吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await oauthApi.revokeToken(id)
    ElMessage.success('令牌已撤销')
    loadTokens()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '撤销令牌失败')
    }
  }
}

/**
 * 判断是否过期
 * @param expiresAt 过期时间
 * @returns {boolean} 是否过期
 */
const isExpired = (expiresAt: string) => {
  return new Date(expiresAt) < new Date()
}

/**
 * 格式化日期
 * @param date 日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadClients()
})

watch(pageSize, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    currentPage.value = 1
    loadClients()
  }
})

watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    loadClients()
  }
})

watch(tokenPageSize, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    tokenCurrentPage.value = 1
    loadTokens()
  }
})

watch(tokenCurrentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    loadTokens()
  }
})
</script>

<style scoped>

</style>

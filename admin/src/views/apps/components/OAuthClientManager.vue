<template>
  <div class="oauth-client-manager">
    <div class="manager-header">
      <h3>OAuth 客户端</h3>
      <el-button type="primary" size="small" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建客户端
      </el-button>
    </div>

    <el-alert
      v-if="!app?.enableOAuth"
      type="warning"
      :closable="false"
      style="margin-bottom: 16px"
    >
      当前应用未启用OAuth功能，请先在应用设置中启用OAuth
    </el-alert>

    <el-table
      v-loading="loading"
      :data="clients"
      stripe
      size="small"
    >
      <el-table-column prop="name" label="客户端名称" min-width="150" />
      <el-table-column prop="clientId" label="客户端ID" min-width="200">
        <template #default="{ row }">
          <div class="client-id-cell">
            <span class="client-id-text">{{ row.clientId }}</span>
            <el-button link type="primary" size="small" @click="copyToClipboard(row.clientId)">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="redirectUris" label="回调地址" min-width="200">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag v-for="uri in row.redirectUris" :key="uri" size="small" type="info">
              {{ uri }}
            </el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button link type="warning" size="small" @click="handleResetSecret(row)">重置密钥</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && clients.length === 0" description="暂无OAuth客户端" />

    <ClientEditDrawer
      v-model:visible="editDrawerVisible"
      :client="currentClient"
      :app-code="app?.code"
      @success="loadClients"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CopyDocument } from '@element-plus/icons-vue'
import { oauthApi, type OAuthClient } from '@/api/oauth'
import type { App } from '@/api/app'
import ClientEditDrawer from './ClientEditDrawer.vue'

interface Props {
  app: App | null
}

const props = defineProps<Props>()

const loading = ref(false)
const clients = ref<OAuthClient[]>([])
const editDrawerVisible = ref(false)
const currentClient = ref<OAuthClient | null>(null)

/**
 * 加载客户端列表
 */
const loadClients = async () => {
  if (!props.app?.code) return
  
  loading.value = true
  try {
    const response = await oauthApi.getClients(1, 100, undefined, props.app.code)
    clients.value = response.data.data.data
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载客户端列表失败')
  } finally {
    loading.value = false
  }
}

/**
 * 创建客户端
 */
const handleCreate = () => {
  if (!props.app?.enableOAuth) {
    ElMessage.warning('请先在应用设置中启用OAuth功能')
    return
  }
  currentClient.value = null
  editDrawerVisible.value = true
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
 * @param client 客户端信息
 */
const handleDelete = async (client: OAuthClient) => {
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

    await oauthApi.deleteClient(client.id)
    ElMessage.success('客户端已删除')
    loadClients()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '删除客户端失败')
    }
  }
}

/**
 * 复制到剪贴板
 * @param text 文本内容
 */
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

watch(() => props.app?.code, (newCode) => {
  if (newCode) {
    loadClients()
  }
}, { immediate: true })

onMounted(() => {
  if (props.app?.code) {
    loadClients()
  }
})
</script>

<style scoped>
.oauth-client-manager {
  margin-top: 20px;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.manager-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.client-id-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.client-id-text {
  font-family: monospace;
  font-size: 12px;
}
</style>

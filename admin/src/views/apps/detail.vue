<template>
  <div class="app-detail-page" v-loading="loading">
    <div class="page-header">
      <el-button @click="handleBack" text>
        <el-icon><ArrowLeft /></el-icon>
        返回列表
      </el-button>
      <h1 class="page-title">{{ app?.name || '应用详情' }}</h1>
      <div class="header-actions">
        <el-button type="primary" @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑应用
        </el-button>
      </div>
    </div>

    <template v-if="app">
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
            <el-tag :type="app.status ? 'success' : 'danger'" size="small">
              {{ app.status ? '启用' : '禁用' }}
            </el-tag>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="应用名称">
            {{ app.name }}
          </el-descriptions-item>
          <el-descriptions-item label="应用标识">
            <el-tag>{{ app.code }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="OAuth状态">
            <el-tag :type="app.enableOAuth ? 'success' : 'info'" size="small">
              {{ app.enableOAuth ? '已启用' : '未启用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="API Key">
            <div class="key-value">
              <code>{{ app.apiKey }}</code>
              <el-button link type="primary" @click="copyToClipboard(app.apiKey)">
                复制
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="Secret Key">
            <div class="key-value">
              <code>{{ app.secretKey }}</code>
              <el-button link type="primary" @click="copyToClipboard(app.secretKey)">
                复制
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="过期时间">
            {{ app.expireAt ? formatDate(app.expireAt) : '永不过期' }}
          </el-descriptions-item>
          <el-descriptions-item label="QPS限制">
            {{ app.qpsLimit }}
          </el-descriptions-item>
          <el-descriptions-item label="每日调用限制">
            {{ app.dailyLimit }}
          </el-descriptions-item>
          <el-descriptions-item label="Token配额">
            {{ app.tokenLimit }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(app.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(app.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="resource-card">
        <template #header>
          <span>资源权限</span>
        </template>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="resource-section">
              <h4>允许使用的模型</h4>
              <div v-if="app.allowedModels?.length" class="tag-list">
                <el-tag
                  v-for="model in app.allowedModels"
                  :key="model"
                  size="small"
                  style="margin: 4px"
                >
                  {{ model }}
                </el-tag>
              </div>
              <div v-else class="empty-text">无限制</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="resource-section">
              <h4>允许使用的智能体</h4>
              <div v-if="app.allowedAgents?.length" class="tag-list">
                <el-tag
                  v-for="agent in app.allowedAgents"
                  :key="agent"
                  size="small"
                  style="margin: 4px"
                >
                  {{ agent }}
                </el-tag>
              </div>
              <div v-else class="empty-text">无限制</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="resource-section">
              <h4>允许使用的技能</h4>
              <div v-if="app.allowedSkills?.length" class="tag-list">
                <el-tag
                  v-for="skill in app.allowedSkills"
                  :key="skill"
                  size="small"
                  style="margin: 4px"
                >
                  {{ skill }}
                </el-tag>
              </div>
              <div v-else class="empty-text">无限制</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="resource-section">
              <h4>允许访问的知识库</h4>
              <div v-if="app.allowedKbs?.length" class="tag-list">
                <el-tag
                  v-for="kb in app.allowedKbs"
                  :key="kb"
                  size="small"
                  style="margin: 4px"
                >
                  {{ kb }}
                </el-tag>
              </div>
              <div v-else class="empty-text">无限制</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="usage-card">
        <template #header>
          <span>使用统计</span>
        </template>

        <div v-loading="usageLoading" class="usage-section">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-statistic title="智能体数量" :value="usage?.agentCount || 0" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="技能数量" :value="usage?.skillCount || 0" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="知识库数量" :value="usage?.kbCount || 0" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="今日调用" :value="usage?.todayCalls || 0" />
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 20px">
            <el-col :span="12">
              <el-progress
                :percentage="dailyUsagePercent"
                :format="() => `${usage?.todayCalls || 0} / ${usage?.dailyLimit || 0}`"
                :color="dailyUsagePercent > 80 ? '#f56c6c' : '#409eff'"
              />
              <div class="progress-label">今日调用 / 每日限制</div>
            </el-col>
            <el-col :span="12">
              <el-statistic title="本月调用" :value="usage?.monthCalls || 0" />
            </el-col>
          </el-row>
        </div>
      </el-card>

      <el-card class="oauth-card">
        <template #header>
          <div class="card-header">
            <span>OAuth 客户端</span>
            <el-tag v-if="!app.enableOAuth" type="warning" size="small">
              未启用OAuth
            </el-tag>
          </div>
        </template>

        <OAuthClientManager :app="app" />
      </el-card>
    </template>

    <AppEditDrawer
      v-model="editDrawerVisible"
      :app="app"
      mode="edit"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Edit } from '@element-plus/icons-vue'
import { appApi, type App, type AppUsage } from '@/api/app'
import AppEditDrawer from './components/AppEditDrawer.vue'
import OAuthClientManager from './components/OAuthClientManager.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const usageLoading = ref(false)
const app = ref<App | null>(null)
const usage = ref<AppUsage | null>(null)
const editDrawerVisible = ref(false)

const dailyUsagePercent = computed(() => {
  if (!usage.value) return 0
  return Math.min(100, Math.round((usage.value.todayCalls / usage.value.dailyLimit) * 100))
})

/**
 * 加载应用详情
 */
const loadApp = async () => {
  const id = route.params.id as string
  if (!id) {
    ElMessage.error('应用ID不存在')
    router.push('/apps')
    return
  }

  loading.value = true
  try {
    const { data } = await appApi.getOne(id)
    app.value = data.data
  } catch (error) {
    console.error('获取应用详情失败:', error)
    ElMessage.error('获取应用详情失败')
    router.push('/apps')
  } finally {
    loading.value = false
  }
}

/**
 * 加载使用统计
 */
const loadUsage = async () => {
  if (!app.value) return

  usageLoading.value = true
  try {
    const { data } = await appApi.getUsage(app.value.id)
    usage.value = data.data
  } catch (error) {
    console.error('获取使用统计失败:', error)
  } finally {
    usageLoading.value = false
  }
}

/**
 * 返回列表
 */
const handleBack = () => {
  router.push('/apps')
}

/**
 * 编辑应用
 */
const handleEdit = () => {
  editDrawerVisible.value = true
}

/**
 * 编辑成功回调
 */
const handleEditSuccess = () => {
  loadApp()
}

/**
 * 复制到剪贴板
 * @param text 文本内容
 */
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
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
  loadApp().then(() => {
    loadUsage()
  })
})
</script>

<style scoped>
.app-detail-page {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.page-title {
  flex: 1;
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.info-card,
.resource-card,
.usage-card,
.oauth-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.key-value {
  display: flex;
  align-items: center;
  gap: 10px;
}

.key-value code {
  font-family: monospace;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.resource-section {
  margin-bottom: 16px;
}

.resource-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #606266;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
}

.empty-text {
  color: #909399;
  font-size: 12px;
}

.usage-section {
  padding: 10px 0;
}

.progress-label {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
</style>

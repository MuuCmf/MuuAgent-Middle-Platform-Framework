<template>
  <div class="app-detail-page" v-loading="loading">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="handleBack" text class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          {{ $t('app.backToList') }}
        </el-button>
        <div class="title-group">
          <h1 class="page-title">{{ app?.name || $t('app.appDetail') }}</h1>
          <el-tag
            v-if="app"
            :type="app.status ? 'success' : 'danger'"
            size="small"
            class="status-tag"
            effect="dark"
            round
          >
            {{ app.status ? $t('app.enabledStatus') : $t('app.disabledStatus') }}
          </el-tag>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleEdit" class="edit-btn">
          <el-icon><Edit /></el-icon>
          {{ $t('app.editApp') }}
        </el-button>
      </div>
    </div>

    <template v-if="app">
      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('app.basicInfo') }}</span>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item :label="$t('app.appName')">
            {{ app.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.appCode')">
            <el-tag effect="plain" round>{{ app.code }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.oauth') + $t('app.status')">
            <el-tag :type="app.enableOAuth ? 'success' : 'info'" size="small" effect="light" round>
              {{ app.enableOAuth ? $t('app.oauthEnabled') : $t('app.oauthDisabled') }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.apiKey')">
            <div class="key-value">
              <code>{{ app.apiKey }}</code>
              <el-button link type="primary" @click="copyToClipboard(app.apiKey)" class="copy-btn">
                {{ $t('app.copy') }}
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.secretKey')">
            <div class="key-value">
              <code>{{ app.secretKey }}</code>
              <el-button link type="primary" @click="copyToClipboard(app.secretKey)" class="copy-btn">
                {{ $t('app.copy') }}
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.expireTime')">
            <span :class="{ 'text-warning': isExpiringSoon }">
              {{ app.expireAt ? formatDate(app.expireAt) : $t('app.neverExpire') }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.qpsLimitLabel')">
            {{ app.qpsLimit }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.dailyCallLimit')">
            {{ app.dailyLimit }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.tokenQuotaMonth')">
            {{ app.tokenLimit }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.createdAt')">
            {{ formatDate(app.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('app.updateTime')">
            {{ formatDate(app.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-row :gutter="20" class="stat-row">
        <el-col :span="8">
          <div class="stat-card stat-card--agent" v-loading="usageLoading">
            <div class="stat-card__icon">
              <el-icon :size="28"><Monitor /></el-icon>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ usage?.agentCount || 0 }}</span>
              <span class="stat-card__label">{{ $t('app.agent') }}</span>
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card stat-card--skill" v-loading="usageLoading">
            <div class="stat-card__icon">
              <el-icon :size="28"><SetUp /></el-icon>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ usage?.skillCount || 0 }}</span>
              <span class="stat-card__label">{{ $t('app.skill') }}</span>
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card stat-card--kb" v-loading="usageLoading">
            <div class="stat-card__icon">
              <el-icon :size="28"><Collection /></el-icon>
            </div>
            <div class="stat-card__content">
              <span class="stat-card__value">{{ usage?.kbCount || 0 }}</span>
              <span class="stat-card__label">{{ $t('app.knowledgeBase') }}</span>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="stat-row">
        <el-col :span="12">
          <div class="metric-card" v-loading="usageLoading">
            <div class="metric-card__header">
              <span class="metric-card__title">{{ $t('app.todayCalls') }}</span>
              <el-icon class="metric-card__icon" :size="18"><TrendCharts /></el-icon>
            </div>
            <div class="metric-card__body">
              <span class="metric-card__value">{{ usage?.todayCalls || 0 }}</span>
              <span class="metric-card__limit">/ {{ usage?.dailyLimit || 0 }}</span>
            </div>
            <el-progress
              :percentage="dailyUsagePercent"
              :show-text="false"
              :stroke-width="6"
              :color="dailyUsagePercent > 80 ? '#f56c6c' : '#6366f1'"
              class="metric-card__progress"
            />
            <div class="metric-card__footer">
              <span>{{ $t('app.monthTotal') }} <strong>{{ usage?.monthCalls || 0 }}</strong> {{ $t('app.times') }}</span>
            </div>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="metric-card" v-loading="usageLoading">
            <div class="metric-card__header">
              <span class="metric-card__title">{{ $t('app.todayToken') }}</span>
              <el-icon class="metric-card__icon" :size="18"><Coin /></el-icon>
            </div>
            <div class="metric-card__body">
              <span class="metric-card__value">{{ usage?.todayTokens || 0 }}</span>
              <span class="metric-card__limit">/ {{ usage?.tokenLimit || 0 }}</span>
            </div>
            <el-progress
              :percentage="tokenUsagePercent"
              :show-text="false"
              :stroke-width="6"
              :color="tokenUsagePercent > 80 ? '#f56c6c' : '#10b981'"
              class="metric-card__progress"
            />
            <div class="metric-card__footer">
              <span>{{ $t('app.todayUsed') }} <strong>{{ usage?.todayTokens || 0 }}</strong> Token</span>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('app.tokenUsageDetail') }}</span>
          </div>
        </template>

        <div v-loading="usageLoading" class="token-detail-section">
          <el-row :gutter="24">
            <el-col :span="12">
              <div class="token-block">
                <h4 class="token-block__title">{{ $t('app.today') }}</h4>
                <div class="token-block__stats">
                  <div class="token-stat">
                    <span class="token-stat__label">{{ $t('app.totalUsage') }}</span>
                    <span class="token-stat__value">{{ usage?.todayTokens || 0 }}</span>
                  </div>
                  <div class="token-stat token-stat--input">
                    <span class="token-stat__label">{{ $t('app.input') }}</span>
                    <span class="token-stat__value">{{ usage?.todayInputTokens || 0 }}</span>
                  </div>
                  <div class="token-stat token-stat--output">
                    <span class="token-stat__label">{{ $t('app.output') }}</span>
                    <span class="token-stat__value">{{ usage?.todayOutputTokens || 0 }}</span>
                  </div>
                </div>
                <div class="token-ratio-bar">
                  <div
                    class="token-ratio-bar__input"
                    :style="{ width: todayInputPercent + '%' }"
                  />
                  <div class="token-ratio-bar__output" />
                </div>
                <div class="token-ratio-legend">
                  <span class="token-ratio-legend__item">
                    <span class="token-ratio-legend__dot token-ratio-legend__dot--input" />
                    {{ $t('app.input') }} {{ usage?.todayInputTokens || 0 }}
                  </span>
                  <span class="token-ratio-legend__item">
                    <span class="token-ratio-legend__dot token-ratio-legend__dot--output" />
                    {{ $t('app.output') }} {{ usage?.todayOutputTokens || 0 }}
                  </span>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="token-block">
                <h4 class="token-block__title">{{ $t('app.month') }}</h4>
                <div class="token-block__stats">
                  <div class="token-stat">
                    <span class="token-stat__label">{{ $t('app.totalUsage') }}</span>
                    <span class="token-stat__value">{{ usage?.monthTokens || 0 }}</span>
                  </div>
                  <div class="token-stat token-stat--input">
                    <span class="token-stat__label">{{ $t('app.input') }}</span>
                    <span class="token-stat__value">{{ usage?.monthInputTokens || 0 }}</span>
                  </div>
                  <div class="token-stat token-stat--output">
                    <span class="token-stat__label">{{ $t('app.output') }}</span>
                    <span class="token-stat__value">{{ usage?.monthOutputTokens || 0 }}</span>
                  </div>
                </div>
                <div class="token-ratio-bar">
                  <div
                    class="token-ratio-bar__input"
                    :style="{ width: monthInputPercent + '%' }"
                  />
                  <div class="token-ratio-bar__output" />
                </div>
                <div class="token-ratio-legend">
                  <span class="token-ratio-legend__item">
                    <span class="token-ratio-legend__dot token-ratio-legend__dot--input" />
                    {{ $t('app.input') }} {{ usage?.monthInputTokens || 0 }}
                  </span>
                  <span class="token-ratio-legend__item">
                    <span class="token-ratio-legend__dot token-ratio-legend__dot--output" />
                    {{ $t('app.output') }} {{ usage?.monthOutputTokens || 0 }}
                  </span>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('app.permissionConfig') }}</span>
          </div>
        </template>

        <PermissionConfig :app-id="app.id" />
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('app.oauthClient') }}</span>
            <el-tag v-if="!app.enableOAuth" type="warning" size="small" effect="light" round>
              {{ $t('app.oauthNotEnabled') }}
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
import { ArrowLeft, Edit, Monitor, SetUp, Collection, TrendCharts, Coin } from '@element-plus/icons-vue'
import { appApi, type App, type AppUsage } from '@/api/app'
import AppEditDrawer from './components/AppEditDrawer.vue'
import OAuthClientManager from './components/OAuthClientManager.vue'
import PermissionConfig from './components/PermissionConfig.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

/** 页面加载状态 */
const loading = ref(false)
/** 使用统计加载状态 */
const usageLoading = ref(false)
/** 应用详情数据 */
const app = ref<App | null>(null)
/** 使用统计数据 */
const usage = ref<AppUsage | null>(null)
/** 编辑抽屉可见状态 */
const editDrawerVisible = ref(false)

/** 今日调用占每日限制百分比 */
const dailyUsagePercent = computed(() => {
  if (!usage.value) return 0
  return Math.min(100, Math.round((usage.value.todayCalls / usage.value.dailyLimit) * 100))
})

/** Token 日用量占日配额百分比 */
const tokenUsagePercent = computed(() => {
  if (!usage.value || !usage.value.tokenLimit) return 0
  return Math.min(100, Math.round((usage.value.todayTokens / usage.value.tokenLimit) * 100))
})

/** 今日输入 Token 占比百分比（用于比例条） */
const todayInputPercent = computed(() => {
  if (!usage.value) return 50
  const input = usage.value.todayInputTokens || 0
  const total = input + (usage.value.todayOutputTokens || 0)
  if (total === 0) return 50
  return Math.round((input / total) * 100)
})

/** 本月输入 Token 占比百分比（用于比例条） */
const monthInputPercent = computed(() => {
  if (!usage.value) return 50
  const input = usage.value.monthInputTokens || 0
  const total = input + (usage.value.monthOutputTokens || 0)
  if (total === 0) return 50
  return Math.round((input / total) * 100)
})

/** 是否即将过期（30天内） */
const isExpiringSoon = computed(() => {
  if (!app.value?.expireAt) return false
  const diff = new Date(app.value.expireAt).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
})

/**
 * 加载应用详情
 */
const loadApp = async () => {
  const id = route.params.id as string
  if (!id) {
    ElMessage.error(t('app.appIdNotExist'))
    router.push('/apps')
    return
  }

  loading.value = true
  try {
    const { data } = await appApi.getOne(id)
    app.value = data.data
  } catch (error) {
    console.error('获取应用详情失败:', error)
    ElMessage.error(t('app.getAppDetailFailed'))
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
    ElMessage.error(t('app.getUsageFailed'))
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
  ElMessage.success(t('app.copiedToClipboard'))
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

<style scoped lang="scss">
.app-detail-page {
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  font-weight: 500;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: #1e1b4b;
}

.status-tag {
  font-size: 12px;
}

.edit-btn {
  border-radius: 8px;
  font-weight: 500;
}

.stat-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
  border-left: 4px solid transparent;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
}

.stat-card--agent .stat-card__icon {
  background: #f2f2f2;
  color: #03b8cf;
}

.stat-card--skill .stat-card__icon {
  background: #f2f2f2;
  color: #10b981;
}

.stat-card--kb .stat-card__icon {
  background: #f2f2f2;
  color: #a78bfa;
}

.stat-card__content {
  display: flex;
  flex-direction: column;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: #1e1b4b;
  line-height: 1.2;
}

.stat-card__label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}

.metric-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.metric-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.metric-card__icon {
  color: #6366f1;
}

.metric-card__body {
  margin-bottom: 12px;
}

.metric-card__value {
  font-size: 32px;
  font-weight: 700;
  color: #1e1b4b;
  line-height: 1.2;
}

.metric-card__limit {
  font-size: 14px;
  color: #9ca3af;
  margin-left: 4px;
}

.metric-card__progress {
  margin-bottom: 12px;
}

.metric-card__footer {
  font-size: 13px;
  color: #6b7280;
}

.metric-card__footer strong {
  color: #1e1b4b;
}

.detail-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.detail-card :deep(.el-card__header) {
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 12px 12px 0 0;
}

.detail-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #1e1b4b;
}

.key-value {
  display: flex;
  align-items: center;
  gap: 10px;
}

.key-value code {
  font-family: 'Fira Code', 'Consolas', monospace;
  background: #f2f2f2;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #999;
  border: 1px solid #e0e7ff;
}

.copy-btn {
  font-weight: 500;
}

.text-warning {
  color: #f59e0b;
  font-weight: 500;
}

.token-detail-section {
  padding: 4px 0;
}

.token-block {
  padding: 16px 20px;
  background: #fafafa;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
}

.token-block__title {
  margin: 0 0 14px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e1b4b;
}

.token-block__stats {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
}

.token-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-stat__label {
  font-size: 12px;
  color: #9ca3af;
}

.token-stat__value {
  font-size: 20px;
  font-weight: 700;
  color: #1e1b4b;
}

.token-stat--input .token-stat__value {
  color: #6366f1;
}

.token-stat--output .token-stat__value {
  color: #10b981;
}

.token-ratio-bar {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: #f3f4f6;
}

.token-ratio-bar__input {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  transition: width 0.4s ease;
}

.token-ratio-bar__output {
  flex: 1;
  background: linear-gradient(135deg, #10b981, #34d399);
}

.token-ratio-legend {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.token-ratio-legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.token-ratio-legend__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.token-ratio-legend__dot--input {
  background: #6366f1;
}

.token-ratio-legend__dot--output {
  background: #10b981;
}

.detail-card :deep(.el-descriptions__label) {
  font-weight: 500;
  color: #6b7280;
}

.detail-card :deep(.el-descriptions__content) {
  color: #1e1b4b;
}
</style>

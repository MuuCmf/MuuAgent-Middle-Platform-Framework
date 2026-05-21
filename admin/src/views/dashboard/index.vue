<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('dashboard.title') }}</h1>
      <p class="page-description">{{ t('dashboard.description') }}</p>
    </div>

    <el-alert
      v-if="alerts.length > 0"
      :title="`${t('dashboard.systemAlert')}：${t('dashboard.unhandledAlerts', { count: alerts.length })}`"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px;"
    >
      <template #default>
        <div class="alert-list">
          <div v-for="alert in alerts.slice(0, 3)" :key="alert.id" class="alert-item">
            <el-tag :type="getAlertType(alert.level)" size="small">{{ alert.level }}</el-tag>
            <span class="alert-message">{{ alert.message }}</span>
            <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
          </div>
          <el-button v-if="alerts.length > 3" text type="primary" size="small" @click="showAllAlerts = true">
            {{ t('dashboard.viewAllAlerts', { count: alerts.length }) }}
          </el-button>
        </div>
      </template>
    </el-alert>

    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-icon-wrapper">
          <el-icon class="stat-icon"><DataLine /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.stats.totalCalls') }}</div>
          <div class="stat-value">{{ animatedStats.totalCalls }}</div>
          <div class="stat-trend" :class="{ 'trend-up': trendData.callsTrend > 0 }">
            <el-icon v-if="trendData.callsTrend > 0"><Top /></el-icon>
            <el-icon v-else><Bottom /></el-icon>
            {{ Math.abs(trendData.callsTrend) }}%
          </div>
        </div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon-wrapper">
          <el-icon class="stat-icon"><CircleCheck /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.stats.successRate') }}</div>
          <div class="stat-value">{{ animatedStats.successRate }}%</div>
          <el-progress :percentage="Number(stats.ai?.successRate || 0)" :show-text="false" :stroke-width="6" />
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon-wrapper">
          <el-icon class="stat-icon"><Timer /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.stats.avgResponseTime') }}</div>
          <div class="stat-value">{{ animatedStats.avgResponseTime }}<span class="stat-unit">ms</span></div>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon-wrapper">
          <el-icon class="stat-icon"><Cpu /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.stats.activeModels') }}</div>
          <div class="stat-value">{{ animatedStats.activeModels }}</div>
        </div>
      </div>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">
            <el-icon><Clock /></el-icon>
            {{ t('dashboard.realtime.title') }}
            <el-tag type="success" size="small" style="margin-left: 10px;">
              <el-icon class="pulse"><Connection /></el-icon>
              {{ t('dashboard.realtime.realtimeUpdate') }}
            </el-tag>
          </div>
          <div class="realtime-stats">
            <div class="realtime-item">
              <span class="realtime-label">{{ t('dashboard.realtime.currentConcurrent') }}</span>
              <span class="realtime-value">{{ realtimeData.currentConcurrent }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">{{ t('dashboard.realtime.currentQps') }}</span>
              <span class="realtime-value">{{ realtimeData.currentQps }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">{{ t('dashboard.realtime.todayCalls') }}</span>
              <span class="realtime-value">{{ realtimeData.todayCalls }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">{{ t('dashboard.realtime.todayErrors') }}</span>
              <span class="realtime-value error">{{ realtimeData.todayErrors }}</span>
            </div>
          </div>
          <el-divider />
          <div class="recent-calls">
            <div class="recent-calls-header">
              <span>{{ t('dashboard.realtime.recentCalls') }}</span>
              <el-button text type="primary" size="small" @click="goToLogs">{{ t('dashboard.realtime.viewAll') }}</el-button>
            </div>
            <el-timeline>
              <el-timeline-item
                v-for="call in recentCalls"
                :key="call.id"
                :timestamp="formatTime(call.createdAt)"
                :type="call.success ? 'success' : 'danger'"
              >
                <div class="call-item">
                  <el-tag size="small">{{ call.modelCode }}</el-tag>
                  <span class="call-duration">{{ call.costMs }}ms</span>
                  <el-tag v-if="!call.success" type="danger" size="small">{{ t('dashboard.realtime.failed') }}</el-tag>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="card">
          <div class="card-title">
            <el-icon><Monitor /></el-icon>
            {{ t('dashboard.modelStatus.title') }}
            <el-button text type="primary" size="small" style="margin-left: auto;" @click="goToMCP">
              {{ t('dashboard.modelStatus.modelConfig') }}
            </el-button>
          </div>
          <div class="model-status-grid">
            <div
              v-for="model in modelStatus"
              :key="model.modelId"
              class="model-status-card"
              :class="getModelStatusClass(model)"
            >
              <div class="model-header">
                <el-tag :type="getModelTagType(model)" effect="dark">
                  {{ getModelStatusText(model) }}
                </el-tag>
                <el-icon v-if="model.circuitOpen" class="warning-icon"><WarningFilled /></el-icon>
              </div>
              <div class="model-name">{{ model.modelName }}</div>
              <div class="model-metrics">
                <div class="metric">
                  <span class="metric-label">{{ t('dashboard.modelStatus.concurrent') }}</span>
                  <span class="metric-value">{{ model.currentConcurrent }}/{{ model.maxConcurrent }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">{{ t('dashboard.modelStatus.qps') }}</span>
                  <span class="metric-value">{{ model.currentQps }}/{{ model.qpsLimit }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">{{ t('dashboard.modelStatus.errors') }}</span>
                  <span class="metric-value" :class="{ 'error-value': model.errorCount > 0 }">
                    {{ model.errorCount }}
                  </span>
                </div>
              </div>
              <el-progress
                :percentage="getConcurrentPercentage(model)"
                :status="getProgressStatus(model)"
                :show-text="false"
                :stroke-width="3"
              />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">📈 {{ t('dashboard.modelTypeStats.title') }}</div>
          <el-table :data="stats.modelTypeStats || []" stripe>
            <el-table-column prop="modelType" :label="t('dashboard.modelTypeStats.modelType')" width="150">
              <template #default="{ row }">
                <el-tag>{{ row.modelType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" :label="t('dashboard.modelTypeStats.callCount')" width="120">
              <template #default="{ row }">
                <el-progress
                  :percentage="getPercentage(row.count, totalModelTypeCalls)"
                  :show-text="false"
                  style="width: 80px; display: inline-block;"
                />
                <span style="margin-left: 10px;">{{ row.count }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('dashboard.modelTypeStats.description')">
              <template #default="{ row }">
                {{ getModelTypeDesc(row.modelType) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="card">
          <div class="card-title">🏆 {{ t('dashboard.topModels.title') }}</div>
          <el-table :data="topModels" stripe>
            <el-table-column :label="t('dashboard.topModels.rank')" width="70">
              <template #default="{ $index }">
                <el-tag
                  :type="$index < 3 ? 'warning' : 'info'"
                  effect="plain"
                >
                  {{ $index + 1 }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="modelCode" :label="t('dashboard.topModels.modelCode')" width="200">
              <template #default="{ row }">
                <el-tag type="info">{{ row.modelCode }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" :label="t('dashboard.topModels.callCount')" width="100" />
            <el-table-column prop="avgCostMs" :label="t('dashboard.topModels.avgCostMs')">
              <template #default="{ row }">
                <el-tag :type="getResponseTimeType(row.avgCostMs)" size="small">
                  {{ row.avgCostMs }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showAllAlerts" :title="t('dashboard.alert.title')" width="600px">
      <el-table :data="alerts" stripe max-height="400">
        <el-table-column prop="level" :label="t('dashboard.alert.level')" width="100">
          <template #default="{ row }">
            <el-tag :type="getAlertType(row.level)" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" :label="t('dashboard.alert.message')" />
        <el-table-column prop="timestamp" :label="t('dashboard.alert.time')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Clock, Monitor, Top, Bottom, Connection, WarningFilled, DataLine, CircleCheck, Timer, Cpu } from '@element-plus/icons-vue'
import { logApi, type Statistics, type Log } from '@/api/log'
import { routingApi, type ModelRoutingStatus } from '@/api/model-routing'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()

const stats = ref<Statistics>({
  modelTypeStats: [],
  modelStats: []
})
const modelStatus = ref<ModelRoutingStatus[]>([])
const recentCalls = ref<Log[]>([])
const showAllAlerts = ref(false)

const animatedStats = ref({
  totalCalls: 0,
  successRate: 0,
  avgResponseTime: 0,
  activeModels: 0
})

const trendData = ref({
  callsTrend: 0
})

const realtimeData = ref({
  currentConcurrent: 0,
  currentQps: 0,
  todayCalls: 0,
  todayErrors: 0
})

const alerts = ref<Array<{
  id: string
  level: string
  message: string
  timestamp: string
}>>([])

let updateInterval: number | null = null

const totalModelTypeCalls = computed(() => {
  return stats.value.modelTypeStats?.reduce((sum, item) => sum + item.count, 0) || 0
})

const topModels = computed(() => {
  return stats.value.modelStats?.slice(0, 5) || []
})

const loadStats = async () => {
  try {
    const res = await logApi.getStatistics()
    stats.value = res.data.data || {}
    
    animateNumber('totalCalls', stats.value.ai?.total || 0)
    animateNumber('successRate', stats.value.ai?.successRate || 0)
    
    const avgCost = stats.value.modelStats?.reduce((sum, m) => sum + (Number(m.avgCostMs) || 0), 0) / (stats.value.modelStats?.length || 1) || 0
    animateNumber('avgResponseTime', Math.round(avgCost))
    
    trendData.value.callsTrend = Math.random() * 20 - 10
  } catch (error) {
    console.error(t('dashboard.loading.stats'), error)
  }
}

const loadModelStatus = async () => {
  try {
    const res = await routingApi.getStatus()
    modelStatus.value = res.data.data || []
    
    animateNumber('activeModels', modelStatus.value.filter(m => !m.circuitOpen).length)
    
    realtimeData.value.currentConcurrent = modelStatus.value.reduce((sum, m) => sum + (Number(m.currentConcurrent) || 0), 0)
    realtimeData.value.currentQps = modelStatus.value.reduce((sum, m) => sum + (Number(m.currentQps) || 0), 0)
    
    checkAlerts()
  } catch (error) {
    console.error(t('dashboard.loading.modelStatus'), error)
  }
}

const loadRecentCalls = async () => {
  try {
    const res = await logApi.getAiLogs({ pageSize: 10 })
    recentCalls.value = res.data.data.list || []
    
    realtimeData.value.todayCalls = recentCalls.value.length
    realtimeData.value.todayErrors = recentCalls.value.filter(c => !c.success).length
  } catch (error) {
    console.error(t('dashboard.loading.recentCalls'), error)
  }
}

const checkAlerts = () => {
  const newAlerts: Array<{ id: string; level: string; message: string; timestamp: string }> = []
  
  modelStatus.value.forEach(model => {
    if (model.circuitOpen) {
      newAlerts.push({
        id: `circuit-${model.modelId}`,
        level: 'ERROR',
        message: t('dashboard.alert.circuitBreaker', { name: model.modelName }),
        timestamp: new Date().toISOString()
      })
    }
    
    if (model.errorCount > 5) {
      newAlerts.push({
        id: `error-${model.modelId}`,
        level: 'WARNING',
        message: t('dashboard.alert.highErrorCount', { name: model.modelName, count: model.errorCount }),
        timestamp: new Date().toISOString()
      })
    }
    
    if (model.currentConcurrent >= model.maxConcurrent * 0.9) {
      newAlerts.push({
        id: `concurrent-${model.modelId}`,
        level: 'WARNING',
        message: t('dashboard.alert.concurrentLimit', { name: model.modelName }),
        timestamp: new Date().toISOString()
      })
    }
  })
  
  alerts.value = newAlerts
}

const animateNumber = (key: string, target: number) => {
  const current = animatedStats.value[key as keyof typeof animatedStats.value] as number
  const diff = target - current
  const steps = 20
  const increment = diff / steps
  let step = 0
  
  const timer = setInterval(() => {
    step++
    if (step >= steps) {
      animatedStats.value[key as keyof typeof animatedStats.value] = target
      clearInterval(timer)
    } else {
      animatedStats.value[key as keyof typeof animatedStats.value] = Math.round(current + increment * step)
    }
  }, 30)
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getPercentage = (value: number, total: number) => {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

const getAlertType = (level: string) => {
  const typeMap: Record<string, any> = {
    ERROR: 'danger',
    WARNING: 'warning',
    INFO: 'info'
  }
  return typeMap[level] || 'info'
}

const getModelTypeDesc = (type: string) => {
  const descMap: Record<string, string> = {
    llm: t('dashboard.modelTypeStats.descriptions.llm'),
    embedding: t('dashboard.modelTypeStats.descriptions.embedding'),
    tts: t('dashboard.modelTypeStats.descriptions.tts'),
    asr: t('dashboard.modelTypeStats.descriptions.asr'),
    image: t('dashboard.modelTypeStats.descriptions.image'),
    multimodal: t('dashboard.modelTypeStats.descriptions.multimodal')
  }
  return descMap[type] || t('dashboard.modelTypeStats.descriptions.other')
}

const getResponseTimeType = (time: number) => {
  if (time < 1000) return 'success'
  if (time < 3000) return 'warning'
  return 'danger'
}

const getModelStatusClass = (model: ModelRoutingStatus) => {
  if (model.circuitOpen) return 'status-error'
  if (model.errorCount > 5) return 'status-warning'
  return 'status-normal'
}

const getModelTagType = (model: ModelRoutingStatus) => {
  if (model.circuitOpen) return 'danger'
  if (model.errorCount > 5) return 'warning'
  return 'success'
}

const getModelStatusText = (model: ModelRoutingStatus) => {
  if (model.circuitOpen) return t('dashboard.modelStatus.circuitOpen')
  if (model.errorCount > 5) return t('dashboard.modelStatus.abnormal')
  return t('dashboard.modelStatus.normal')
}

const getConcurrentPercentage = (model: ModelRoutingStatus) => {
  return Math.round((model.currentConcurrent / model.maxConcurrent) * 100)
}

const getProgressStatus = (model: ModelRoutingStatus) => {
  const percentage = getConcurrentPercentage(model)
  if (percentage >= 90) return 'exception'
  if (percentage >= 70) return 'warning'
  return 'success'
}

const goToLogs = () => {
  router.push('/logs')
}

const goToMCP = () => {
  router.push('/models')
}

onMounted(() => {
  loadStats()
  loadModelStatus()
  loadRecentCalls()
  
  updateInterval = window.setInterval(() => {
    loadModelStatus()
    loadRecentCalls()
  }, 5000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid #f0f0f0;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
  
  &.primary {
    .stat-icon-wrapper {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  }
  
  &.success {
    .stat-icon-wrapper {
      background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
    }
  }
  
  &.warning {
    .stat-icon-wrapper {
      background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%);
    }
  }
  
  &.info {
    .stat-icon-wrapper {
      background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
    }
  }
  
  .stat-icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    
    .stat-icon {
      font-size: 28px;
      color: white;
    }
  }
  
  .stat-content {
    flex: 1;
    min-width: 0;
    
    .stat-label {
      font-size: 14px;
      color: #8c8c8c;
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #262626;
      margin-bottom: 8px;
      line-height: 1.2;
      
      .stat-unit {
        font-size: 18px;
        color: #8c8c8c;
        margin-left: 4px;
        font-weight: 500;
      }
    }
    
    .stat-trend {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 500;
      
      &.trend-up {
        color: #52c41a;
        background: #f6ffed;
      }
      
      &:not(.trend-up) {
        color: #ff4d4f;
        background: #fff2f0;
      }
    }
    
    .el-progress {
      margin-top: 8px;
    }
  }
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .alert-message {
    flex: 1;
    font-size: 13px;
  }
  
  .alert-time {
    font-size: 12px;
    color: #909399;
  }
}

.realtime-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.realtime-item {
  text-align: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  
  .realtime-label {
    display: block;
    font-size: 12px;
    color: #909399;
    margin-bottom: 8px;
  }
  
  .realtime-value {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    
    &.error {
      color: #f56c6c;
    }
  }
}

.recent-calls {
  .recent-calls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 500;
  }
  
  .call-item {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .call-duration {
      font-size: 12px;
      color: #909399;
    }
  }
}

.model-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.model-status-card {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s;
  
  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
  
  &.status-error {
    border-color: #f56c6c;
    background: #fef0f0;
  }
  
  &.status-warning {
    border-color: #e6a23c;
    background: #fdf6ec;
  }
  
  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .warning-icon {
      color: #e6a23c;
      font-size: 16px;
    }
  }
  
  .model-name {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
  }
  
  .model-metrics {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    
    .metric {
      text-align: center;
      
      .metric-label {
        display: block;
        font-size: 11px;
        color: #909399;
        margin-bottom: 4px;
      }
      
      .metric-value {
        font-size: 13px;
        font-weight: 600;
        color: #303133;
        
        &.error-value {
          color: #f56c6c;
        }
      }
    }
  }
}

.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

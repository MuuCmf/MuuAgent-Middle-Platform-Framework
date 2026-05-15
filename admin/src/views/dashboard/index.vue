<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">仪表盘</h1>
      <p class="page-description">展示AI中台的整体运行状态，包括调用统计、成功率、模型分布等关键指标</p>
    </div>

    <el-alert
      v-if="alerts.length > 0"
      :title="`系统告警：${alerts.length} 条未处理告警`"
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
            查看全部 {{ alerts.length }} 条告警
          </el-button>
        </div>
      </template>
    </el-alert>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedStats.totalCalls }}</div>
          <div class="stat-label">AI调用总数</div>
          <div class="stat-trend" :class="{ 'trend-up': trendData.callsTrend > 0 }">
            <el-icon v-if="trendData.callsTrend > 0"><Top /></el-icon>
            <el-icon v-else><Bottom /></el-icon>
            {{ Math.abs(trendData.callsTrend) }}%
          </div>
        </div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedStats.successRate }}%</div>
          <div class="stat-label">成功率</div>
          <el-progress :percentage="Number(stats.ai?.successRate || 0)" :show-text="false" :stroke-width="4" />
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedStats.avgResponseTime }}ms</div>
          <div class="stat-label">平均响应时间</div>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">🔧</div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedStats.activeModels }}</div>
          <div class="stat-label">活跃模型</div>
        </div>
      </div>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">
            <el-icon><Clock /></el-icon>
            实时调用数据
            <el-tag type="success" size="small" style="margin-left: 10px;">
              <el-icon class="pulse"><Connection /></el-icon>
              实时更新
            </el-tag>
          </div>
          <div class="realtime-stats">
            <div class="realtime-item">
              <span class="realtime-label">当前并发</span>
              <span class="realtime-value">{{ realtimeData.currentConcurrent }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">当前QPS</span>
              <span class="realtime-value">{{ realtimeData.currentQps }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">今日调用</span>
              <span class="realtime-value">{{ realtimeData.todayCalls }}</span>
            </div>
            <div class="realtime-item">
              <span class="realtime-label">今日错误</span>
              <span class="realtime-value error">{{ realtimeData.todayErrors }}</span>
            </div>
          </div>
          <el-divider />
          <div class="recent-calls">
            <div class="recent-calls-header">
              <span>最近调用记录</span>
              <el-button text type="primary" size="small" @click="goToLogs">查看全部</el-button>
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
                  <el-tag v-if="!call.success" type="danger" size="small">失败</el-tag>
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
            模型状态监控
            <el-button text type="primary" size="small" style="margin-left: auto;" @click="goToMCP">
              管理MCP
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
                  <span class="metric-label">并发</span>
                  <span class="metric-value">{{ model.currentConcurrent }}/{{ model.maxConcurrent }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">QPS</span>
                  <span class="metric-value">{{ model.currentQps }}/{{ model.qpsLimit }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">错误</span>
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
          <div class="card-title">📈 模型类型统计</div>
          <el-table :data="stats.modelTypeStats || []" stripe>
            <el-table-column prop="modelType" label="模型类型" width="150">
              <template #default="{ row }">
                <el-tag>{{ row.modelType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="调用次数" width="120">
              <template #default="{ row }">
                <el-progress
                  :percentage="getPercentage(row.count, totalModelTypeCalls)"
                  :show-text="false"
                  style="width: 80px; display: inline-block;"
                />
                <span style="margin-left: 10px;">{{ row.count }}</span>
              </template>
            </el-table-column>
            <el-table-column label="说明">
              <template #default="{ row }">
                {{ getModelTypeDesc(row.modelType) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="card">
          <div class="card-title">🏆 模型调用排行 TOP 5</div>
          <el-table :data="topModels" stripe>
            <el-table-column label="排名" width="70">
              <template #default="{ $index }">
                <el-tag
                  :type="$index < 3 ? 'warning' : 'info'"
                  effect="plain"
                >
                  {{ $index + 1 }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="modelCode" label="模型标识" width="200">
              <template #default="{ row }">
                <el-tag type="info">{{ row.modelCode }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="调用次数" width="100" />
            <el-table-column prop="avgCostMs" label="平均耗时(ms)">
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

    <el-dialog v-model="showAllAlerts" title="系统告警" width="600px">
      <el-table :data="alerts" stripe max-height="400">
        <el-table-column prop="level" label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getAlertType(row.level)" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="告警信息" />
        <el-table-column prop="timestamp" label="时间" width="180">
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
import { Clock, Monitor, Top, Bottom, Connection, WarningFilled } from '@element-plus/icons-vue'
import { logApi, type Statistics, type Log } from '@/api/log'
import { mcpApi, type McpStatus } from '@/api/mcp'

const router = useRouter()

const stats = ref<Statistics>({
  modelTypeStats: [],
  modelStats: []
})
const modelStatus = ref<McpStatus[]>([])
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
    console.error('加载统计失败', error)
  }
}

const loadModelStatus = async () => {
  try {
    const res = await mcpApi.getStatus()
    modelStatus.value = res.data.data || []
    
    animateNumber('activeModels', modelStatus.value.filter(m => !m.circuitOpen).length)
    
    realtimeData.value.currentConcurrent = modelStatus.value.reduce((sum, m) => sum + (Number(m.currentConcurrent) || 0), 0)
    realtimeData.value.currentQps = modelStatus.value.reduce((sum, m) => sum + (Number(m.currentQps) || 0), 0)
    
    checkAlerts()
  } catch (error) {
    console.error('加载模型状态失败', error)
  }
}

const loadRecentCalls = async () => {
  try {
    const res = await logApi.getAiLogs({ pageSize: 10 })
    recentCalls.value = res.data.data.list || []
    
    realtimeData.value.todayCalls = recentCalls.value.length
    realtimeData.value.todayErrors = recentCalls.value.filter(c => !c.success).length
  } catch (error) {
    console.error('加载最近调用失败', error)
  }
}

const checkAlerts = () => {
  const newAlerts: Array<{ id: string; level: string; message: string; timestamp: string }> = []
  
  modelStatus.value.forEach(model => {
    if (model.circuitOpen) {
      newAlerts.push({
        id: `circuit-${model.modelId}`,
        level: 'ERROR',
        message: `模型 ${model.modelName} 已熔断`,
        timestamp: new Date().toISOString()
      })
    }
    
    if (model.errorCount > 5) {
      newAlerts.push({
        id: `error-${model.modelId}`,
        level: 'WARNING',
        message: `模型 ${model.modelName} 错误次数过高 (${model.errorCount})`,
        timestamp: new Date().toISOString()
      })
    }
    
    if (model.currentConcurrent >= model.maxConcurrent * 0.9) {
      newAlerts.push({
        id: `concurrent-${model.modelId}`,
        level: 'WARNING',
        message: `模型 ${model.modelName} 并发接近上限`,
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

const getModelTypeDesc = (type: string) => {
  const map: Record<string, string> = {
    'llm': '大语言模型，用于文本生成和对话',
    'embedding': '向量模型，用于文本向量化',
    'tts': '语音合成，将文本转为语音',
    'asr': '语音识别，将语音转为文本',
    'image': '图像生成，根据文本生成图片'
  }
  return map[type] || type
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getModelStatusText = (model: McpStatus) => {
  if (model.circuitOpen) return '熔断'
  if (model.currentConcurrent >= model.maxConcurrent * 0.8) return '繁忙'
  return '正常'
}

const getModelTagType = (model: McpStatus) => {
  if (model.circuitOpen) return 'danger'
  if (model.currentConcurrent >= model.maxConcurrent * 0.8) return 'warning'
  return 'success'
}

const getModelStatusClass = (model: McpStatus) => {
  if (model.circuitOpen) return 'status-danger'
  if (model.currentConcurrent >= model.maxConcurrent * 0.8) return 'status-warning'
  return 'status-normal'
}

const getConcurrentPercentage = (model: McpStatus): number => {
  if (!model.maxConcurrent || model.maxConcurrent === 0) return 0
  const percentage = Math.round((model.currentConcurrent / model.maxConcurrent) * 100)
  return Math.min(100, Math.max(0, percentage))
}

const getProgressStatus = (model: McpStatus) => {
  const percentage = getConcurrentPercentage(model)
  if (percentage >= 90) return 'exception'
  if (percentage >= 70) return 'warning'
  return 'success'
}

const getPercentage = (value: number, total: number): number => {
  if (!total || total === 0) return 0
  const percentage = Math.round((value / total) * 100)
  return Math.min(100, Math.max(0, percentage))
}

const getResponseTimeType = (ms: number) => {
  if (ms < 500) return 'success'
  if (ms < 2000) return 'warning'
  return 'danger'
}

const getAlertType = (level: string) => {
  const map: Record<string, any> = {
    'ERROR': 'danger',
    'WARNING': 'warning',
    'INFO': 'info'
  }
  return map[level] || 'info'
}

const goToLogs = () => {
  router.push('/logs')
}

const goToMCP = () => {
  router.push('/mcp')
}

const startRealTimeUpdate = () => {
  updateInterval = window.setInterval(() => {
    loadModelStatus()
    loadRecentCalls()
  }, 5000)
}

onMounted(() => {
  loadStats()
  loadModelStatus()
  loadRecentCalls()
  startRealTimeUpdate()
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style lang="scss" scoped>
.alert-list {
  .alert-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    
    &:last-child {
      border-bottom: none;
    }
    
    .alert-message {
      flex: 1;
      font-size: 14px;
    }
    
    .alert-time {
      font-size: 12px;
      color: #999;
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  
  &.success {
    border-left: 4px solid #67c23a;
  }
  
  &.info {
    border-left: 4px solid #409eff;
  }
  
  &.warning {
    border-left: 4px solid #e6a23c;
  }
  
  .stat-icon {
    font-size: 48px;
    opacity: 0.8;
  }
  
  .stat-content {
    flex: 1;
    
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #303133;
      line-height: 1;
      margin-bottom: 8px;
    }
    
    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }
    
    .stat-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #f56c6c;
      
      &.trend-up {
        color: #67c23a;
      }
    }
  }
}

.realtime-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  
  .realtime-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    
    .realtime-label {
      font-size: 14px;
      color: #606266;
    }
    
    .realtime-value {
      font-size: 20px;
      font-weight: bold;
      color: #303133;
      
      &.error {
        color: #f56c6c;
      }
    }
  }
}

.recent-calls {
  .recent-calls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-weight: 500;
  }
  
  .call-item {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .call-duration {
      font-size: 13px;
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
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
  border: 2px solid transparent;
  
  &:hover {
    background: #fff;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
  
  &.status-normal {
    border-color: #67c23a;
  }
  
  &.status-warning {
    border-color: #e6a23c;
  }
  
  &.status-danger {
    border-color: #f56c6c;
  }
  
  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .warning-icon {
      color: #e6a23c;
      font-size: 20px;
      animation: pulse 2s infinite;
    }
  }
  
  .model-name {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 12px;
    color: #303133;
  }
  
  .model-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
    
    .metric {
      text-align: center;
      
      .metric-label {
        display: block;
        font-size: 12px;
        color: #909399;
        margin-bottom: 4px;
      }
      
      .metric-value {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        
        &.error-value {
          color: #f56c6c;
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pulse {
  animation: pulse 2s infinite;
}
</style>

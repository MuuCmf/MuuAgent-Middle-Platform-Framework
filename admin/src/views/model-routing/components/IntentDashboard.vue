<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 监控说明</div>
    <ul>
      <li><strong>意图分布</strong>：展示各意图类型的请求分布情况</li>
      <li><strong>模型使用排行</strong>：展示各模型的使用频率排名</li>
      <li><strong>降级统计</strong>：展示降级原因分布，帮助优化调度策略</li>
      <li><strong>趋势图</strong>：展示请求量随时间的变化趋势</li>
    </ul>
  </div>

  <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
    <el-date-picker
      v-model="dashboardDateRange"
      type="daterange"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      format="YYYY-MM-DD"
      value-format="YYYY-MM-DD"
      style="width: 260px;"
      @change="loadDashboardAll"
    />

    <el-select v-model="dashboardFilterAppCode" placeholder="应用筛选" clearable style="width: 160px;" @change="loadDashboardAll">
      <el-option v-for="app in dashboardApps" :key="app.code" :label="app.name" :value="app.code" />
    </el-select>

    <el-button @click="loadDashboardAll">
      <el-icon><Refresh /></el-icon>
      刷新
    </el-button>
  </div>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="总请求数" :value="dashboardOverview?.totalRequests || 0">
          <template #prefix>
            <el-icon><DataLine /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="成功率" :value="dashboardOverview?.successRate || 0" suffix="%">
          <template #prefix>
            <el-icon><TrendCharts /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="平均耗时" :value="dashboardOverview?.avgCostMs || 0" suffix="ms">
          <template #prefix>
            <el-icon><PieChart /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="降级率" :value="dashboardOverview?.degradeRate || 0" suffix="%">
          <template #prefix>
            <el-icon><WarningFilled /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
  </el-row>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="12">
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>意图分布</span>
            <el-tag v-if="dashboardOverview" type="info" size="small">{{ dashboardOverview.intentDistribution?.length || 0 }} 种意图</el-tag>
          </div>
        </template>
        <div class="distribution-list">
          <div v-for="item in dashboardOverview?.intentDistribution" :key="item.intent" class="distribution-item">
            <div class="distribution-header">
              <el-tag :type="getDashboardIntentTagType(item.intent)" size="small">
                {{ getDashboardIntentLabel(item.intent) }}
              </el-tag>
              <span class="distribution-count">{{ item.count }} 次 ({{ item.percentage }}%)</span>
            </div>
            <el-progress
              :percentage="item.percentage"
              :color="getDashboardIntentColor(item.intent)"
              :stroke-width="12"
            />
          </div>
          <el-empty v-if="!dashboardOverview?.intentDistribution?.length" description="暂无数据" :image-size="60" />
        </div>
      </el-card>
    </el-col>

    <el-col :span="12">
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>模型使用排行</span>
            <el-tag v-if="dashboardModelUsage.length" type="info" size="small">{{ dashboardModelUsage.length }} 个模型</el-tag>
          </div>
        </template>
        <div class="distribution-list">
          <div v-for="(item, index) in dashboardModelUsage" :key="item.modelCode" class="distribution-item">
            <div class="distribution-header">
              <div>
                <el-tag :type="index === 0 ? 'danger' : index === 1 ? 'warning' : index === 2 ? 'success' : 'info'" size="small">
                  #{{ index + 1 }}
                </el-tag>
                <span style="margin-left: 8px;">{{ item.modelCode }}</span>
              </div>
              <span class="distribution-count">{{ item.count }} 次</span>
            </div>
            <el-progress
              :percentage="dashboardModelUsage.length ? Math.round((item.count / dashboardModelUsage[0].count) * 100) : 0"
              :color="index === 0 ? '#ff4d4f' : index === 1 ? '#faad14' : index === 2 ? '#52c41a' : '#1890ff'"
              :stroke-width="12"
            />
          </div>
          <el-empty v-if="!dashboardModelUsage.length" description="暂无数据" :image-size="60" />
        </div>
      </el-card>
    </el-col>
  </el-row>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="12">
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>降级统计</span>
            <el-tag v-if="dashboardDegradeStats.length" type="warning" size="small">{{ dashboardDegradeStats.length }} 种原因</el-tag>
          </div>
        </template>
        <div class="distribution-list">
          <div v-for="item in dashboardDegradeStats" :key="item.reason" class="distribution-item">
            <div class="distribution-header">
              <span class="degrade-reason">{{ item.reason }}</span>
              <span class="distribution-count">{{ item.count }} 次</span>
            </div>
            <el-progress
              :percentage="dashboardDegradeStats.length ? Math.round((item.count / dashboardDegradeStats[0].count) * 100) : 0"
              color="#faad14"
              :stroke-width="12"
            />
          </div>
          <el-empty v-if="!dashboardDegradeStats.length" description="暂无降级数据" :image-size="60" />
        </div>
      </el-card>
    </el-col>

    <el-col :span="12">
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>请求趋势</span>
            <el-radio-group v-model="dashboardTrendGranularity" size="small" @change="loadDashboardTrend">
              <el-radio-button value="hour">按小时</el-radio-button>
              <el-radio-button value="day">按天</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div class="trend-chart">
          <div class="trend-bars">
            <div v-for="(point, index) in dashboardTrendData" :key="index" class="trend-bar-wrapper">
              <div class="trend-bar-container">
                <div
                  class="trend-bar success-bar"
                  :style="{ height: getDashboardBarHeight(point.successCount || 0, dashboardMaxTrendValue) }"
                  :title="`成功: ${point.successCount || 0}`"
                />
                <div
                  class="trend-bar fail-bar"
                  :style="{ height: getDashboardBarHeight(point.failCount || 0, dashboardMaxTrendValue) }"
                  :title="`失败: ${point.failCount || 0}`"
                />
              </div>
              <span class="trend-label">{{ formatDashboardTrendLabel(point.time) }}</span>
            </div>
          </div>
          <div class="trend-legend">
            <div class="legend-item">
              <div class="legend-color success-color" />
              <span>成功</span>
            </div>
            <div class="legend-item">
              <div class="legend-color fail-color" />
              <span>失败</span>
            </div>
          </div>
        </div>
        <el-empty v-if="!dashboardTrendData.length" description="暂无趋势数据" :image-size="60" />
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, DataLine, TrendCharts, PieChart, WarningFilled } from '@element-plus/icons-vue'
import {
  intentDashboardApi,
  type DashboardOverview,
  type TrendPoint,
  type ModelUsageRank,
  type DegradeStat
} from '@/api/intent-dashboard'
import { appApi } from '@/api/app'

const dashboardDateRange = ref<[string, string] | null>(null)
const dashboardFilterAppCode = ref<string>()
const dashboardApps = ref<Array<{ code: string; name: string }>>([])

const dashboardOverview = ref<DashboardOverview | null>(null)
const dashboardTrendData = ref<TrendPoint[]>([])
const dashboardTrendGranularity = ref<'hour' | 'day'>('hour')
const dashboardModelUsage = ref<ModelUsageRank[]>([])
const dashboardDegradeStats = ref<DegradeStat[]>([])

/**
 * 看板最大趋势值
 */
const dashboardMaxTrendValue = computed(() => {
  if (!dashboardTrendData.value.length) return 1
  return Math.max(...dashboardTrendData.value.map(d => d.count), 1)
})

/**
 * 看板意图标签类型
 */
const getDashboardIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: 'primary',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: 'info',
    asr: 'warning'
  }
  return map[intent] || 'primary'
}

/**
 * 看板意图标签文本
 */
const getDashboardIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 看板意图颜色
 */
const getDashboardIntentColor = (intent: string): string => {
  const map: Record<string, string> = {
    general: '#1890ff',
    code: '#52c41a',
    math: '#faad14',
    creative: '#ff4d4f',
    image: '#722ed1',
    tts: '#13c2c2',
    asr: '#eb2f96'
  }
  return map[intent] || '#1890ff'
}

/**
 * 看板柱状图高度
 */
const getDashboardBarHeight = (value: number, max: number): string => {
  if (max === 0) return '0%'
  return `${(value / max) * 100}%`
}

/**
 * 格式化看板趋势标签
 */
const formatDashboardTrendLabel = (time: string): string => {
  if (!time) return '-'
  if (dashboardTrendGranularity.value === 'hour') {
    return time.slice(-5)
  }
  return time.slice(5)
}

/**
 * 加载看板应用列表
 */
const loadDashboardApps = async () => {
  try {
    const res = await appApi.getList()
    dashboardApps.value = res.data.data?.list || []
  } catch {
    // 忽略
  }
}

/**
 * 加载看板概览
 */
const loadDashboardOverview = async () => {
  try {
    const res = await intentDashboardApi.getOverview({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1],
      appCode: dashboardFilterAppCode.value
    })
    dashboardOverview.value = res.data.data || null
  } catch {
    ElMessage.error('加载概览数据失败')
  }
}

/**
 * 加载看板趋势
 */
const loadDashboardTrend = async () => {
  try {
    const res = await intentDashboardApi.getTrend({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1],
      granularity: dashboardTrendGranularity.value
    })
    dashboardTrendData.value = res.data.data || []
  } catch {
    ElMessage.error('加载趋势数据失败')
  }
}

/**
 * 加载看板模型使用排行
 */
const loadDashboardModelUsage = async () => {
  try {
    const res = await intentDashboardApi.getModelUsage({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1]
    })
    dashboardModelUsage.value = res.data.data || []
  } catch {
    ElMessage.error('加载模型使用数据失败')
  }
}

/**
 * 加载看板降级统计
 */
const loadDashboardDegradeStats = async () => {
  try {
    const res = await intentDashboardApi.getDegradeStats({
      startDate: dashboardDateRange.value?.[0],
      endDate: dashboardDateRange.value?.[1]
    })
    dashboardDegradeStats.value = res.data.data || []
  } catch {
    ElMessage.error('加载降级统计数据失败')
  }
}

/**
 * 加载看板所有数据
 */
const loadDashboardAll = () => {
  loadDashboardOverview()
  loadDashboardTrend()
  loadDashboardModelUsage()
  loadDashboardDegradeStats()
}

onMounted(() => {
  loadDashboardApps()
  loadDashboardAll()
})
</script>

<style scoped lang="scss">
.distribution-list {
  .distribution-item {
    margin-bottom: 16px;

    .distribution-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      .distribution-count {
        font-size: 13px;
        color: #666;
      }
    }

    .degrade-reason {
      font-size: 13px;
      color: #333;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.trend-chart {
  .trend-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 200px;
    padding: 0 8px;

    .trend-bar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;

      .trend-bar-container {
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 1px;

        .trend-bar {
          width: 100%;
          border-radius: 2px 2px 0 0;
          min-height: 2px;
          transition: height 0.3s;

          &.success-bar {
            background: #52c41a;
          }

          &.fail-bar {
            background: #ff4d4f;
          }
        }
      }

      .trend-label {
        font-size: 10px;
        color: #999;
        margin-top: 4px;
        writing-mode: vertical-lr;
        text-orientation: mixed;
      }
    }
  }

  .trend-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 12px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;

        &.success-color {
          background: #52c41a;
        }

        &.fail-color {
          background: #ff4d4f;
        }
      }
    }
  }
}
</style>
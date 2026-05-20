<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 {{ $t('routingLog.helpTitle') }}</div>
    <ul>
      <li><strong>{{ $t('routingLog.helpItem1') }}</strong></li>
      <li><strong>{{ $t('routingLog.helpItem2') }}</strong></li>
      <li><strong>{{ $t('routingLog.helpItem3') }}</strong></li>
      <li><strong>{{ $t('routingLog.helpItem4') }}</strong></li>
    </ul>
  </div>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('routingLog.totalRoutes')" :value="routingLogStats?.total || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('routingLog.successRate')" :value="routingLogStats?.successRate || 0" suffix="%">
          <template #prefix>
            <el-icon><TrendCharts /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('routingLog.avgLatency')" :value="routingLogStats?.avgCostMs || 0" suffix="ms">
          <template #prefix>
            <el-icon><PieChart /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('routingLog.degradeRate')" :value="routingLogStats?.degradeRate || 0" suffix="%">
          <template #prefix>
            <el-icon><WarningFilled /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
  </el-row>

  <div class="card">
    <div class="card-title">
      {{ $t('routingLog.title') }}
      <el-tag type="info" size="small">{{ routingLogTotal }} {{ $t('routingLog.items') }}</el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="routingLogFilterIntent" :placeholder="$t('routingLog.intentType')" clearable style="width: 140px;" @change="loadRoutingLogAll">
        <el-option v-for="item in intentOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>

      <el-select v-model="routingLogFilterSource" :placeholder="$t('routingLog.source')" clearable style="width: 140px;" @change="loadRoutingLogAll">
        <el-option v-for="item in routingSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>

      <el-input v-model="routingLogFilterModelType" :placeholder="$t('routingLog.modelType')" clearable style="width: 160px;" @clear="loadRoutingLogAll" @keyup.enter="loadRoutingLogAll" />

      <el-select v-model="routingLogFilterSuccess" :placeholder="$t('routingLog.result')" clearable style="width: 100px;" @change="loadRoutingLogAll">
        <el-option :label="$t('routingLog.success')" :value="true" />
        <el-option :label="$t('routingLog.failed')" :value="false" />
      </el-select>

      <el-select v-model="routingLogFilterDegraded" :placeholder="$t('routingLog.degraded')" clearable style="width: 100px;" @change="loadRoutingLogAll">
        <el-option :label="$t('routingLog.yes')" :value="true" />
        <el-option :label="$t('routingLog.no')" :value="false" />
      </el-select>

      <el-date-picker
        v-model="routingLogFilterDateRange"
        type="daterange"
        :range-separator="$t('intentDashboard.dateRangeSeparator')"
        :start-placeholder="$t('intentDashboard.startDate')"
        :end-placeholder="$t('intentDashboard.endDate')"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 260px;"
        @change="loadRoutingLogAll"
      />

      <el-button @click="loadRoutingLogAll">
        <el-icon><Refresh /></el-icon>
        {{ $t('routingLog.refresh') }}
      </el-button>
    </div>

    <el-table :data="routingLogList" stripe v-loading="routingLogLoading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="detectedIntent" :label="$t('routingLog.detectedIntent')" width="120">
        <template #default="{ row }">
          <el-tag :type="getRoutingLogIntentTagType(row.detectedIntent)">
            {{ getIntentLabel(row.detectedIntent) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="source" :label="$t('routingLog.source')" width="100">
        <template #default="{ row }">
          <el-tag :type="getRoutingLogSourceTagType(row.source)">{{ getSourceLabel(row.source) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="selectedModelCode" :label="$t('routingLog.selectedModel')" width="140">
        <template #default="{ row }">
          <el-tag v-if="row.selectedModelCode" size="small">{{ row.selectedModelCode }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="modelType" :label="$t('routingLog.modelType')" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.modelType" size="small">{{ row.modelType }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="confidence" :label="$t('routingLog.confidence')" width="90" align="center">
        <template #default="{ row }">
          {{ (row.confidence * 100).toFixed(0) }}%
        </template>
      </el-table-column>
      <el-table-column prop="isDegraded" :label="$t('routingLog.degraded')" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isDegraded" type="warning" size="small">{{ $t('routingLog.yes') }}</el-tag>
          <el-tag v-else type="success" size="small">{{ $t('routingLog.no') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="success" :label="$t('routingLog.result')" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? $t('routingLog.success') : $t('routingLog.failed') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="costMs" :label="$t('routingLog.cost')" width="80" align="center">
        <template #default="{ row }">
          {{ row.costMs }}ms
        </template>
      </el-table-column>
      <el-table-column prop="appCode" :label="$t('routingLog.app')" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.appCode" size="small" type="info">{{ row.appCode }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" :label="$t('routingLog.time')" width="170">
        <template #default="{ row }">
          {{ formatRoutingLogTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.actions')" width="80" align="right" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="handleViewRoutingLogDetail(row)">{{ $t('routingLog.detail') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <el-pagination
        v-model:current-page="routingLogPage"
        v-model:page-size="routingLogPageSize"
        :total="routingLogTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="loadRoutingLogList"
      />
    </div>
  </div>

  <el-dialog v-model="routingLogDetailVisible" :title="$t('routingLog.detailTitle')" width="650px">
    <el-descriptions v-if="routingLogCurrent" :column="2" border>
      <el-descriptions-item label="ID">{{ routingLogCurrent.id }}</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.time')">{{ formatRoutingLogTime(routingLogCurrent.createdAt) }}</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.detectedIntent')">
        <el-tag :type="getRoutingLogIntentTagType(routingLogCurrent.detectedIntent)">
          {{ getIntentLabel(routingLogCurrent.detectedIntent) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.confidence')">{{ (routingLogCurrent.confidence * 100).toFixed(0) }}%</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.source')">
        <el-tag :type="getRoutingLogSourceTagType(routingLogCurrent.source)">{{ getSourceLabel(routingLogCurrent.source) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.modelType')">{{ routingLogCurrent.modelType || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.selectedModel')">{{ routingLogCurrent.selectedModelCode || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.routeCost')">{{ routingLogCurrent.costMs }}ms</el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.isDegraded')">
        <el-tag :type="routingLogCurrent.isDegraded ? 'warning' : 'success'">
          {{ routingLogCurrent.isDegraded ? $t('routingLog.yes') : $t('routingLog.no') }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('routingLog.routeResult')">
        <el-tag :type="routingLogCurrent.success ? 'success' : 'danger'">
          {{ routingLogCurrent.success ? $t('routingLog.success') : $t('routingLog.failed') }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.degradeReason" :label="$t('routingLog.degradeReason')" :span="2">
        {{ routingLogCurrent.degradeReason }}
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.errorMessage" :label="$t('routingLog.errorMessage')" :span="2">
        <span style="color: #ff4d4f;">{{ routingLogCurrent.errorMessage }}</span>
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.userMessage" :label="$t('routingLog.userMessage')" :span="2">
        {{ routingLogCurrent.userMessage }}
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.appCode" :label="$t('routingLog.app')">{{ routingLogCurrent.appCode }}</el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.clientIp" :label="$t('routingLog.clientIp')">{{ routingLogCurrent.clientIp }}</el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.uid" :label="$t('routingLog.userId')">{{ routingLogCurrent.uid }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh, TrendCharts, PieChart, WarningFilled } from '@element-plus/icons-vue'
import {
  intentRoutingLogApi,
  type IntentRoutingLog,
  type RoutingLogStats
} from '@/api/intent-routing-log'

const { t } = useI18n()

const routingLogList = ref<IntentRoutingLog[]>([])
const routingLogTotal = ref(0)
const routingLogPage = ref(1)
const routingLogPageSize = ref(20)
const routingLogLoading = ref(false)
const routingLogStats = ref<RoutingLogStats | null>(null)

const routingLogFilterIntent = ref<string>()
const routingLogFilterSource = ref<string>()
const routingLogFilterModelType = ref<string>()
const routingLogFilterSuccess = ref<boolean>()
const routingLogFilterDegraded = ref<boolean>()
const routingLogFilterDateRange = ref<[string, string] | null>(null)

const routingLogDetailVisible = ref(false)
const routingLogCurrent = ref<IntentRoutingLog | null>(null)

const intentOptions = computed(() => [
  { label: `${t('intentLabel.general')}(general)`, value: 'general' },
  { label: `${t('intentLabel.code')}(code)`, value: 'code' },
  { label: `${t('intentLabel.math')}(math)`, value: 'math' },
  { label: `${t('intentLabel.creative')}(creative)`, value: 'creative' },
  { label: `${t('intentLabel.image')}(image)`, value: 'image' },
  { label: `${t('intentLabel.tts')}(tts)`, value: 'tts' },
  { label: `${t('intentLabel.asr')}(asr)`, value: 'asr' },
])

const routingSourceOptions = computed(() => [
  { label: `${t('sourceLabel.specified')}(specified)`, value: 'specified' },
  { label: `${t('sourceLabel.keyword')}(keyword)`, value: 'keyword' },
  { label: `${t('sourceLabel.ai')}(ai)`, value: 'ai' },
  { label: `${t('sourceLabel.default')}(default)`, value: 'default' },
])

const getRoutingLogIntentTagType = (intent: string): string => {
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

const getIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: t('intentLabel.general'),
    code: t('intentLabel.code'),
    math: t('intentLabel.math'),
    creative: t('intentLabel.creative'),
    image: t('intentLabel.image'),
    tts: t('intentLabel.tts'),
    asr: t('intentLabel.asr')
  }
  return map[intent] || intent
}

const getRoutingLogSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    specified: 'primary',
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || 'primary'
}

const getSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    specified: t('sourceLabel.specified'),
    keyword: t('sourceLabel.keyword'),
    ai: t('sourceLabel.ai'),
    default: t('sourceLabel.default')
  }
  return map[source] || source
}

const formatRoutingLogTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

const loadRoutingLogList = async () => {
  routingLogLoading.value = true
  try {
    const res = await intentRoutingLogApi.getList({
      intent: routingLogFilterIntent.value,
      source: routingLogFilterSource.value,
      modelType: routingLogFilterModelType.value,
      success: routingLogFilterSuccess.value,
      isDegraded: routingLogFilterDegraded.value,
      startDate: routingLogFilterDateRange.value?.[0],
      endDate: routingLogFilterDateRange.value?.[1],
      page: routingLogPage.value,
      pageSize: routingLogPageSize.value
    })
    routingLogList.value = res.data.data?.list || []
    routingLogTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error(t('routingLog.loadListFailed'))
  } finally {
    routingLogLoading.value = false
  }
}

const loadRoutingLogStats = async () => {
  try {
    const res = await intentRoutingLogApi.getStats({
      startDate: routingLogFilterDateRange.value?.[0],
      endDate: routingLogFilterDateRange.value?.[1]
    })
    routingLogStats.value = res.data.data || null
  } catch {
    // ignore
  }
}

const handleViewRoutingLogDetail = (row: IntentRoutingLog) => {
  routingLogCurrent.value = row
  routingLogDetailVisible.value = true
}

const loadRoutingLogAll = () => {
  loadRoutingLogList()
  loadRoutingLogStats()
}

onMounted(() => {
  loadRoutingLogAll()
})
</script>

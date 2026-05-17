<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 路由日志说明</div>
    <ul>
      <li><strong>检测意图</strong>：系统识别出的用户意图类型</li>
      <li><strong>分类来源</strong>：specified(指定模型)、keyword(关键词匹配)、ai(AI分类)、default(默认)</li>
      <li><strong>降级</strong>：当首选模型不可用时，是否触发了降级策略</li>
      <li><strong>耗时</strong>：路由决策过程的耗时</li>
    </ul>
  </div>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="总路由次数" :value="routingLogStats?.total || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="成功率" :value="routingLogStats?.successRate || 0" suffix="%">
          <template #prefix>
            <el-icon><TrendCharts /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="平均耗时" :value="routingLogStats?.avgCostMs || 0" suffix="ms">
          <template #prefix>
            <el-icon><PieChart /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="降级率" :value="routingLogStats?.degradeRate || 0" suffix="%">
          <template #prefix>
            <el-icon><WarningFilled /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </el-col>
  </el-row>

  <div class="card">
    <div class="card-title">
      路由日志
      <el-tag type="info" size="small">{{ routingLogTotal }} 条</el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="routingLogFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadRoutingLogAll">
        <el-option label="通用(general)" value="general" />
        <el-option label="代码(code)" value="code" />
        <el-option label="数学(math)" value="math" />
        <el-option label="创意(creative)" value="creative" />
        <el-option label="生图(image)" value="image" />
        <el-option label="语音合成(tts)" value="tts" />
        <el-option label="语音识别(asr)" value="asr" />
      </el-select>

      <el-select v-model="routingLogFilterSource" placeholder="来源" clearable style="width: 140px;" @change="loadRoutingLogAll">
        <el-option label="指定模型(specified)" value="specified" />
        <el-option label="关键词(keyword)" value="keyword" />
        <el-option label="AI分类(ai)" value="ai" />
        <el-option label="默认(default)" value="default" />
      </el-select>

      <el-input v-model="routingLogFilterModelType" placeholder="模型类型" clearable style="width: 160px;" @clear="loadRoutingLogAll" @keyup.enter="loadRoutingLogAll" />

      <el-select v-model="routingLogFilterSuccess" placeholder="结果" clearable style="width: 100px;" @change="loadRoutingLogAll">
        <el-option label="成功" :value="true" />
        <el-option label="失败" :value="false" />
      </el-select>

      <el-select v-model="routingLogFilterDegraded" placeholder="降级" clearable style="width: 100px;" @change="loadRoutingLogAll">
        <el-option label="是" :value="true" />
        <el-option label="否" :value="false" />
      </el-select>

      <el-date-picker
        v-model="routingLogFilterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 260px;"
        @change="loadRoutingLogAll"
      />

      <el-button @click="loadRoutingLogAll">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-table :data="routingLogList" stripe v-loading="routingLogLoading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="detectedIntent" label="检测意图" width="120">
        <template #default="{ row }">
          <el-tag :type="getRoutingLogIntentTagType(row.detectedIntent)">
            {{ getRoutingLogIntentLabel(row.detectedIntent) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="source" label="来源" width="100">
        <template #default="{ row }">
          <el-tag :type="getRoutingLogSourceTagType(row.source)">{{ getRoutingLogSourceLabel(row.source) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="selectedModelCode" label="选中模型" width="140">
        <template #default="{ row }">
          <el-tag v-if="row.selectedModelCode" size="small">{{ row.selectedModelCode }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="modelType" label="模型类型" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.modelType" size="small">{{ row.modelType }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="confidence" label="置信度" width="90" align="center">
        <template #default="{ row }">
          {{ (row.confidence * 100).toFixed(0) }}%
        </template>
      </el-table-column>
      <el-table-column prop="isDegraded" label="降级" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isDegraded" type="warning" size="small">是</el-tag>
          <el-tag v-else type="success" size="small">否</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="success" label="结果" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="costMs" label="耗时" width="80" align="center">
        <template #default="{ row }">
          {{ row.costMs }}ms
        </template>
      </el-table-column>
      <el-table-column prop="appCode" label="应用" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.appCode" size="small" type="info">{{ row.appCode }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="170">
        <template #default="{ row }">
          {{ formatRoutingLogTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" align="right" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="handleViewRoutingLogDetail(row)">详情</el-button>
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

  <el-dialog v-model="routingLogDetailVisible" title="路由日志详情" width="650px">
    <el-descriptions v-if="routingLogCurrent" :column="2" border>
      <el-descriptions-item label="ID">{{ routingLogCurrent.id }}</el-descriptions-item>
      <el-descriptions-item label="时间">{{ formatRoutingLogTime(routingLogCurrent.createdAt) }}</el-descriptions-item>
      <el-descriptions-item label="检测意图">
        <el-tag :type="getRoutingLogIntentTagType(routingLogCurrent.detectedIntent)">
          {{ getRoutingLogIntentLabel(routingLogCurrent.detectedIntent) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="置信度">{{ (routingLogCurrent.confidence * 100).toFixed(0) }}%</el-descriptions-item>
      <el-descriptions-item label="分类来源">
        <el-tag :type="getRoutingLogSourceTagType(routingLogCurrent.source)">{{ getRoutingLogSourceLabel(routingLogCurrent.source) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="模型类型">{{ routingLogCurrent.modelType || '-' }}</el-descriptions-item>
      <el-descriptions-item label="选中模型">{{ routingLogCurrent.selectedModelCode || '-' }}</el-descriptions-item>
      <el-descriptions-item label="路由耗时">{{ routingLogCurrent.costMs }}ms</el-descriptions-item>
      <el-descriptions-item label="是否降级">
        <el-tag :type="routingLogCurrent.isDegraded ? 'warning' : 'success'">
          {{ routingLogCurrent.isDegraded ? '是' : '否' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="路由结果">
        <el-tag :type="routingLogCurrent.success ? 'success' : 'danger'">
          {{ routingLogCurrent.success ? '成功' : '失败' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.degradeReason" label="降级原因" :span="2">
        {{ routingLogCurrent.degradeReason }}
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.errorMessage" label="错误信息" :span="2">
        <span style="color: #ff4d4f;">{{ routingLogCurrent.errorMessage }}</span>
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.userMessage" label="用户消息" :span="2">
        {{ routingLogCurrent.userMessage }}
      </el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.appCode" label="应用">{{ routingLogCurrent.appCode }}</el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.clientIp" label="客户端IP">{{ routingLogCurrent.clientIp }}</el-descriptions-item>
      <el-descriptions-item v-if="routingLogCurrent.uid" label="用户ID">{{ routingLogCurrent.uid }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, TrendCharts, PieChart, WarningFilled } from '@element-plus/icons-vue'
import {
  intentRoutingLogApi,
  type IntentRoutingLog,
  type RoutingLogStats
} from '@/api/intent-routing-log'

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

/**
 * 路由日志意图标签类型
 */
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

/**
 * 路由日志意图标签文本
 */
const getRoutingLogIntentLabel = (intent: string): string => {
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
 * 路由日志来源标签类型
 */
const getRoutingLogSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    specified: 'primary',
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || 'primary'
}

/**
 * 路由日志来源标签文本
 */
const getRoutingLogSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    specified: '指定模型',
    keyword: '关键词',
    ai: 'AI分类',
    default: '默认'
  }
  return map[source] || source
}

/**
 * 格式化路由日志时间
 */
const formatRoutingLogTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载路由日志列表
 */
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
    ElMessage.error('加载日志列表失败')
  } finally {
    routingLogLoading.value = false
  }
}

/**
 * 加载路由日志统计
 */
const loadRoutingLogStats = async () => {
  try {
    const res = await intentRoutingLogApi.getStats({
      startDate: routingLogFilterDateRange.value?.[0],
      endDate: routingLogFilterDateRange.value?.[1]
    })
    routingLogStats.value = res.data.data || null
  } catch {
    // 忽略
  }
}

/**
 * 查看路由日志详情
 */
const handleViewRoutingLogDetail = (row: IntentRoutingLog) => {
  routingLogCurrent.value = row
  routingLogDetailVisible.value = true
}

/**
 * 加载路由日志所有数据
 */
const loadRoutingLogAll = () => {
  loadRoutingLogList()
  loadRoutingLogStats()
}

onMounted(() => {
  loadRoutingLogAll()
})
</script>
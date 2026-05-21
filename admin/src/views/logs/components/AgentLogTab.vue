<template>
  <div class="agent-log-tab">
    <div class="filter-section">
      <el-input v-model="filters.agentCode" :placeholder="t('log.agent.agentCode')" clearable style="width: 200px" @clear="handleSearch"
        @keyup.enter="handleSearch" />
      <el-select v-model="filters.success" :placeholder="t('log.common.callStatus')" clearable style="width: 120px" @change="handleSearch">
        <el-option :label="t('log.common.success')" :value="true" />
        <el-option :label="t('log.common.failed')" :value="false" />
      </el-select>
      <el-date-picker v-model="filters.timeRange" type="datetimerange" :range-separator="t('log.common.timeRangeSeparator')"
        :start-placeholder="t('log.common.startTime')" :end-placeholder="t('log.common.endTime')"
        value-format="YYYY-MM-DD HH:mm:ss" style="width: 360px" @change="handleSearch" />
      <el-button type="primary" @click="handleSearch">{{ t('log.common.search') }}</el-button>
      <el-button @click="handleReset">{{ t('log.common.reset') }}</el-button>
    </div>

    <el-table :data="logs" stripe v-loading="loading">
      <el-table-column :label="t('log.common.callTime')" width="180">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('log.agent.agentInfo')" width="200">
        <template #default="{ row }">
          <div>
            <el-tag type="primary" size="small">{{ row.agent?.code || row.agentId }}</el-tag>
            <div style="font-size: 12px; color: #999; margin-top: 4px">
              {{ row.agent?.name || '-' }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.agent.conversationId')" width="220">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #666">{{ row.conversationId || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.common.costTime')" width="100" align="right">
        <template #default="{ row }">
          <span :style="{ color: row.costMs > 5000 ? '#ff4d4f' : '#52c41a' }">
            {{ row.costMs }}ms
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.common.status')" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? t('log.common.success') : t('log.common.failed') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.common.clientIp')" width="140">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.common.errorMessage')" min-width="200">
        <template #default="{ row }">
          <el-tooltip v-if="row.errorMessage" :content="row.errorMessage" placement="top">
            <span style="color: #ff4d4f; font-size: 12px; cursor: pointer">
              {{ truncateText(row.errorMessage, 30) }}
            </span>
          </el-tooltip>
          <span v-else style="color: #999">{{ t('log.common.noData') }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('log.common.operation')" width="100" fixed="right" align="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleViewDetail(row)">
            {{ t('log.common.detail') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-section">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper" />
    </div>

    <el-drawer v-model="detailVisible" :title="t('log.agent.detailTitle')" direction="rtl" size="60%">
      <div v-if="currentLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('log.common.logId')">{{ currentLog.id }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.common.callTime')">{{ formatTime(currentLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.agent.agentCode')">{{ currentLog.agent?.code || currentLog.agentId }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.agent.agentName')">{{ currentLog.agent?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.common.costTime')">{{ currentLog.costMs }}ms</el-descriptions-item>
          <el-descriptions-item :label="t('log.common.status')">
            <el-tag :type="currentLog.success ? 'success' : 'danger'">
              {{ currentLog.success ? t('log.common.success') : t('log.common.failed') }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('log.agent.reasoningMode')">
            <el-tag v-if="currentLog.reasoningMode" size="small">
              {{ getReasoningModeLabel(currentLog.reasoningMode) }}
            </el-tag>
            <span v-else style="color: #999">{{ t('log.common.noData') }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('log.common.clientIp')">{{ currentLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.common.uid')">{{ currentLog.uid || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.common.appCode')">{{ currentLog.appCode || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('log.agent.conversationId')">{{ currentLog.conversationId || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentLog.errorMessage" class="error-section">
          <h4>{{ t('log.common.errorInfo') }}</h4>
          <el-alert type="error" :closable="false">
            <pre>{{ currentLog.errorMessage }}</pre>
          </el-alert>
        </div>

        <div v-if="parsedReasoningSteps.length > 0" class="reasoning-section">
          <h4>{{ t('log.agent.reasoningProcess') }}</h4>
          <div class="reasoning-steps">
            <div v-for="(step, index) in parsedReasoningSteps" :key="index" class="reasoning-step">
              <div class="step-header">
                <span class="step-number">{{ step.stepNumber }}</span>
                <span class="step-type" :class="step.stepType">
                  {{ getStepTypeLabel(step.stepType) }}
                </span>
                <span v-if="step.costMs" class="step-cost">{{ step.costMs }}ms</span>
              </div>
              <div class="step-content">
                <div v-if="step.thought" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.thought') }}</span>
                  <div class="item-value">{{ step.thought }}</div>
                </div>
                <div v-if="step.action" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.action') }}</span>
                  <div class="item-value">{{ step.action }}</div>
                </div>
                <div v-if="step.actionInput" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.actionInput') }}</span>
                  <pre class="item-code">{{ formatJson(JSON.stringify(step.actionInput)) }}</pre>
                </div>
                <div v-if="step.observation" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.observation') }}</span>
                  <div class="item-value">{{ step.observation }}</div>
                </div>
                <div v-if="step.toolName" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.toolName') }}</span>
                  <el-tag size="small" type="warning">{{ step.toolName }}</el-tag>
                </div>
                <div v-if="step.toolArgs" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.toolArgs') }}</span>
                  <pre class="item-code">{{ formatJson(JSON.stringify(step.toolArgs)) }}</pre>
                </div>
                <div v-if="step.toolOutput" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.toolOutput') }}</span>
                  <pre class="item-code">{{ formatJson(JSON.stringify(step.toolOutput)) }}</pre>
                </div>
                <div v-if="step.content && !step.thought && !step.action && !step.observation" class="step-item">
                  <span class="item-label">{{ t('log.agent.stepItemLabels.content') }}</span>
                  <div class="item-value">{{ step.content }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="request-section">
          <h4>{{ t('log.common.requestData') }}</h4>
          <el-input type="textarea" :model-value="formatJson(currentLog.request)" :rows="10" readonly />
        </div>

        <div class="response-section">
          <h4>{{ t('log.common.responseData') }}</h4>
          <el-input type="textarea" :model-value="formatJson(currentLog.response)" :rows="10" readonly />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { logApi, type AgentLog } from '@/api/log'
import type { ReasoningStep } from '@/api/agent'

const { t } = useI18n()

const loading = ref(false)
const logs = ref<AgentLog[]>([])
const detailVisible = ref(false)
const currentLog = ref<AgentLog | null>(null)

const filters = reactive({
  agentCode: '',
  success: undefined as boolean | undefined,
  timeRange: null as [string, string] | null,
})

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

/**
 * 解析并合并推理步骤
 * 优先使用 reasoningSteps 数组，如果为空则解析 steps 字符串
 */
const parsedReasoningSteps = computed<ReasoningStep[]>(() => {
  if (!currentLog.value) return []

  if (currentLog.value.reasoningSteps && currentLog.value.reasoningSteps.length > 0) {
    return currentLog.value.reasoningSteps
  }

  if (currentLog.value.steps) {
    try {
      const steps = JSON.parse(currentLog.value.steps)
      return Array.isArray(steps) ? steps : []
    } catch {
      return []
    }
  }

  return []
})

/**
 * 格式化时间
 * @param time 时间字符串
 * @returns 格式化后的时间
 */
const formatTime = (time: string) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 截断文本
 * @param text 文本内容
 * @param maxLength 最大长度
 * @returns 截断后的文本
 */
const truncateText = (text: string, maxLength: number) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

/**
 * 格式化JSON
 * @param json JSON字符串
 * @returns 格式化后的JSON
 */
const formatJson = (json: string | undefined) => {
  if (!json) return ''
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

/**
 * 获取推理模式标签
 * @param mode 推理模式
 * @returns 推理模式标签
 */
const getReasoningModeLabel = (mode: string) => {
  return t(`log.agent.reasoningModeLabels.${mode}`) || mode
}

/**
 * 获取步骤类型标签
 * @param type 步骤类型
 * @returns 步骤类型标签
 */
const getStepTypeLabel = (type: string) => {
  return t(`log.agent.stepTypeLabels.${type}`) || type
}

/**
 * 加载日志列表
 */
const loadLogs = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
    }

    if (filters.agentCode) params.agentCode = filters.agentCode
    if (filters.success !== undefined) params.success = filters.success
    if (filters.timeRange && filters.timeRange.length === 2) {
      params.startTime = filters.timeRange[0]
      params.endTime = filters.timeRange[1]
    }

    const res = await logApi.getAgentLogs(params)
    logs.value = res.data.data?.list || []
    total.value = res.data.data?.total || 0
  } catch (error) {
    console.error(t('log.agent.loadFailed'), error)
  } finally {
    loading.value = false
  }
}

/**
 * 搜索
 */
const handleSearch = () => {
  page.value = 1
  loadLogs()
}

/**
 * 重置
 */
const handleReset = () => {
  filters.agentCode = ''
  filters.success = undefined
  filters.timeRange = null
  page.value = 1
  loadLogs()
}

/**
 * 查看详情
 * @param log 日志对象
 */
const handleViewDetail = async (log: AgentLog) => {
  try {
    const res = await logApi.getAgentLogById(log.id)
    currentLog.value = res.data.data
    detailVisible.value = true
  } catch (error) {
    console.error(t('log.agent.loadDetailFailed'), error)
  }
}

onMounted(() => {
  loadLogs()
})

watch(pageSize, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    page.value = 1
    loadLogs()
  }
})

watch(page, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    loadLogs()
  }
})
</script>

<style lang="scss" scoped>
.agent-log-tab {
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

  .log-detail {
    h4 {
      margin: 20px 0 10px;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
  }

  .error-section {
    margin-top: 20px;

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }

  .request-section,
  .response-section {
    margin-top: 20px;
  }

  .reasoning-section {
    margin-top: 20px;

    h4 {
      margin-bottom: 16px;
    }
  }

  .reasoning-steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .reasoning-step {
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    overflow: hidden;
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;

    .step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
      background: #409eff;
      border-radius: 4px;
      font-weight: 500;
      font-size: 12px;
      color: #fff;
    }

    .step-type {
      font-weight: 500;
      font-size: 14px;
      color: #303133;
    }

    .step-cost {
      margin-left: auto;
      font-size: 12px;
      color: #909399;
    }
  }

  .step-content {
    padding: 16px;
  }

  .step-item {
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .item-label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 13px;
    color: #606266;
  }

  .item-value {
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
    color: #303133;
  }

  .item-code {
    padding: 8px 12px;
    margin: 0;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: #303133;
    overflow-x: auto;
  }
}
</style>

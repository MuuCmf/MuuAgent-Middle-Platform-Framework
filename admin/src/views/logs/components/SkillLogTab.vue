<template>
  <div class="skill-log-tab">
    <div class="filter-section">
      <el-input v-model="filters.skillCode" placeholder="技能代码" clearable style="width: 200px" @clear="handleSearch"
        @keyup.enter="handleSearch" />
      <el-select v-model="filters.success" placeholder="调用状态" clearable style="width: 120px" @change="handleSearch">
        <el-option label="成功" :value="true" />
        <el-option label="失败" :value="false" />
      </el-select>
      <el-date-picker v-model="filters.timeRange" type="datetimerange" range-separator="至" start-placeholder="开始时间"
        end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 360px" @change="handleSearch" />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table :data="logs" stripe v-loading="loading">
      <el-table-column label="调用时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="技能信息" width="200">
        <template #default="{ row }">
          <div>
            <el-tag type="warning" size="small">{{ row.skillCode }}</el-tag>
            <div style="font-size: 12px; color: #999; margin-top: 4px">
              {{ row.skillName }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="100" align="right">
        <template #default="{ row }">
          <span :style="{ color: row.costMs > 5000 ? '#ff4d4f' : '#52c41a' }">
            {{ row.costMs }}ms
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">
            {{ row.success ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="客户端IP" width="140">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="错误信息" min-width="200">
        <template #default="{ row }">
          <el-tooltip v-if="row.errorMessage" :content="row.errorMessage" placement="top">
            <span style="color: #ff4d4f; font-size: 12px; cursor: pointer">
              {{ truncateText(row.errorMessage, 30) }}
            </span>
          </el-tooltip>
          <span v-else style="color: #999">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="handleViewDetail(row)">
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-section">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper" />
    </div>

    <el-drawer v-model="detailVisible" title="Skill调用日志详情" direction="rtl" size="60%">
      <div v-if="currentLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
          <el-descriptions-item label="调用时间">{{ formatTime(currentLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="技能代码">{{ currentLog.skillCode }}</el-descriptions-item>
          <el-descriptions-item label="技能名称">{{ currentLog.skillName }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentLog.costMs }}ms</el-descriptions-item>
          <el-descriptions-item label="调用状态">
            <el-tag :type="currentLog.success ? 'success' : 'danger'">
              {{ currentLog.success ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户端IP">{{ currentLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户代理">{{ currentLog.userAgent || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentLog.errorMessage" class="error-section">
          <h4>错误信息</h4>
          <el-alert type="error" :closable="false">
            <pre>{{ currentLog.errorMessage }}</pre>
          </el-alert>
        </div>

        <div class="request-section">
          <h4>请求数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentLog.request)" :rows="10" readonly />
        </div>

        <div class="response-section">
          <h4>响应数据</h4>
          <el-input type="textarea" :model-value="formatJson(currentLog.response)" :rows="10" readonly />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { logApi, type SkillLog } from '@/api/log'

const loading = ref(false)
const logs = ref<SkillLog[]>([])
const detailVisible = ref(false)
const currentLog = ref<SkillLog | null>(null)

const filters = reactive({
  skillCode: '',
  success: undefined as boolean | undefined,
  timeRange: null as [string, string] | null,
})

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

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
 * 加载日志列表
 */
const loadLogs = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
    }

    if (filters.skillCode) params.skillCode = filters.skillCode
    if (filters.success !== undefined) params.success = filters.success
    if (filters.timeRange && filters.timeRange.length === 2) {
      params.startTime = filters.timeRange[0]
      params.endTime = filters.timeRange[1]
    }

    const res = await logApi.getSkillLogs(params)
    logs.value = res.data.data?.list || []
    total.value = res.data.data?.total || 0
  } catch (error) {
    console.error('加载Skill日志失败', error)
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

const handleReset = () => {
  filters.skillCode = ''
  filters.success = undefined
  filters.timeRange = null
  page.value = 1
  loadLogs()
}

/**
 * 查看详情
 * @param log 日志对象
 */
const handleViewDetail = async (log: SkillLog) => {
  try {
    const res = await logApi.getSkillLogById(log.id)
    currentLog.value = res.data.data
    detailVisible.value = true
  } catch (error) {
    console.error('加载Skill日志详情失败', error)
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
.skill-log-tab {
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
}
</style>

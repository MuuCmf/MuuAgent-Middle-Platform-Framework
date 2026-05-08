<template>
  <div class="retrieval-log-tab">
    <div class="filter-section">
      <el-input v-model="filters.kbId" placeholder="知识库ID" clearable style="width: 250px" @clear="handleSearch"
        @keyup.enter="handleSearch" />
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
      <el-table-column label="知识库信息" width="200">
        <template #default="{ row }">
          <div>
            <el-tag type="success" size="small">{{ row.kbInfo?.kbName || row.kbId }}</el-tag>
            <div v-if="row.kbInfo" style="font-size: 12px; color: #999; margin-top: 4px">
              ID: {{ row.kbId.substring(0, 8) }}...
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="query" label="查询内容" min-width="200">
        <template #default="{ row }">
          <el-tooltip :content="row.query" placement="top">
            <span style="font-size: 12px; color: #666">
              {{ truncateText(row.query, 50) }}
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="Top N" width="80" align="center">
        <template #default="{ row }">
          <span style="font-size: 12px">{{ row.topN || 5 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="相似度阈值" width="100" align="center">
        <template #default="{ row }">
          <span style="font-size: 12px">{{ row.similarityThresh || 0.5 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="检索数量" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.retrievalCount || 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="100" align="right">
        <template #default="{ row }">
          <span :style="{ color: row.costTime > 3000 ? '#ff4d4f' : '#52c41a' }">
            {{ row.costTime }}ms
          </span>
        </template>
      </el-table-column>
      <el-table-column label="客户端IP" width="140">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #666">{{ row.clientIp || '-' }}</span>
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
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadLogs" @current-change="loadLogs" />
    </div>

    <el-drawer v-model="detailVisible" title="知识库检索日志详情" direction="rtl" size="60%">
      <div v-if="currentLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
          <el-descriptions-item label="调用时间">{{ formatTime(currentLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="知识库ID">
            {{ currentLog.kbId }}
          </el-descriptions-item>
          <el-descriptions-item label="知识库名称">
            {{ currentLog.kbInfo?.kbName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="Top N">{{ currentLog.topN || 5 }}</el-descriptions-item>
          <el-descriptions-item label="相似度阈值">{{ currentLog.similarityThresh || 0.5 }}</el-descriptions-item>
          <el-descriptions-item label="检索数量">
            <el-tag size="small" type="info">{{ currentLog.retrievalCount || 0 }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentLog.costTime }}ms</el-descriptions-item>
          <el-descriptions-item label="请求ID">{{ currentLog.requestId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户端IP">{{ currentLog.clientIp || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="query-section">
          <h4>查询内容</h4>
          <el-input type="textarea" :model-value="currentLog.query" :rows="3" readonly />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { logApi, type RetrievalLog } from '@/api/log'

const loading = ref(false)
const logs = ref<RetrievalLog[]>([])
const detailVisible = ref(false)
const currentLog = ref<RetrievalLog | null>(null)

const filters = reactive({
  kbId: '',
  timeRange: null as [string, string] | null,
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
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
 * 加载日志列表
 */
const loadLogs = async () => {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }

    if (filters.kbId) params.kbId = filters.kbId
    if (filters.timeRange && filters.timeRange.length === 2) {
      params.startTime = filters.timeRange[0]
      params.endTime = filters.timeRange[1]
    }

    const res = await logApi.getRetrievalLogs(params)
    logs.value = res.data.data?.list || []
    pagination.total = res.data.data?.total || 0
  } catch (error) {
    console.error('加载知识库检索日志失败', error)
  } finally {
    loading.value = false
  }
}

/**
 * 搜索
 */
const handleSearch = () => {
  pagination.page = 1
  loadLogs()
}

/**
 * 重置
 */
const handleReset = () => {
  filters.kbId = ''
  filters.timeRange = null
  pagination.page = 1
  loadLogs()
}

/**
 * 查看详情
 * @param log 日志对象
 */
const handleViewDetail = async (log: RetrievalLog) => {
  try {
    const res = await logApi.getRetrievalLogById(log.id)
    currentLog.value = res.data.data
    detailVisible.value = true
  } catch (error) {
    console.error('加载知识库检索日志详情失败', error)
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<style lang="scss" scoped>
.retrieval-log-tab {
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

  .query-section {
    margin-top: 20px;
  }
}
</style>

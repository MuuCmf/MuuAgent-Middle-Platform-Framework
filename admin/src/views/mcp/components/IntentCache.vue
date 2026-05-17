<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 缓存说明</div>
    <ul>
      <li><strong>意图缓存</strong>：缓存用户消息的意图识别结果，避免重复分析</li>
      <li><strong>缓存来源</strong>：keyword(关键词匹配)、ai(AI分类)、default(默认)</li>
      <li><strong>命中次数</strong>：该缓存被命中的次数，越高说明缓存效果越好</li>
      <li><strong>清除缓存</strong>：可按条件清除或清除全部缓存</li>
    </ul>
  </div>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="缓存总数" :value="cacheStats?.total || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="总命中次数" :value="cacheStats?.totalHits || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="意图种类" :value="cacheStats?.byIntent ? Object.keys(cacheStats.byIntent).length : 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic title="来源种类" :value="cacheStats?.bySource ? Object.keys(cacheStats.bySource).length : 0" />
      </el-card>
    </el-col>
  </el-row>

  <div class="card">
    <div class="card-title">
      缓存列表
      <el-tag type="info" size="small">{{ cacheTotal }} 条</el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="cacheFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadCacheAll">
        <el-option label="通用(general)" value="general" />
        <el-option label="代码(code)" value="code" />
        <el-option label="数学(math)" value="math" />
        <el-option label="创意(creative)" value="creative" />
        <el-option label="生图(image)" value="image" />
        <el-option label="语音合成(tts)" value="tts" />
        <el-option label="语音识别(asr)" value="asr" />
      </el-select>

      <el-select v-model="cacheFilterSource" placeholder="来源" clearable style="width: 140px;" @change="loadCacheAll">
        <el-option label="关键词(keyword)" value="keyword" />
        <el-option label="AI分类(ai)" value="ai" />
        <el-option label="默认(default)" value="default" />
      </el-select>

      <el-button @click="loadCacheAll">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>

      <el-button type="warning" @click="handleClearCacheByFilter">
        <el-icon><Delete /></el-icon>
        按条件清除
      </el-button>

      <el-button type="danger" @click="handleClearAllCache">
        <el-icon><Delete /></el-icon>
        清除全部
      </el-button>
    </div>

    <el-table :data="cacheList" stripe v-loading="cacheLoading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="intent" label="意图类型" width="140">
        <template #default="{ row }">
          <el-tag :type="getCacheIntentTagType(row.intent)">{{ getCacheIntentLabel(row.intent) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="source" label="来源" width="120">
        <template #default="{ row }">
          <el-tag :type="getCacheSourceTagType(row.source)">{{ getCacheSourceLabel(row.source) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="messageHash" label="消息Hash" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <code style="font-size: 12px;">{{ row.messageHash }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="hitCount" label="命中次数" width="100" align="center" />
      <el-table-column prop="createdAt" label="创建时间" width="170">
        <template #default="{ row }">
          {{ formatCacheTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="lastHitAt" label="最后命中" width="170">
        <template #default="{ row }">
          {{ formatCacheTime(row.lastHitAt) }}
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <el-pagination
        v-model:current-page="cachePage"
        v-model:page-size="cachePageSize"
        :total="cacheTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="loadCacheList"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'
import { intentCacheApi, type IntentCacheItem, type CacheStats } from '@/api/intent-cache'

const cacheList = ref<IntentCacheItem[]>([])
const cacheTotal = ref(0)
const cachePage = ref(1)
const cachePageSize = ref(20)
const cacheLoading = ref(false)
const cacheStats = ref<CacheStats | null>(null)

const cacheFilterIntent = ref<string>()
const cacheFilterSource = ref<string>()

/**
 * 缓存意图标签类型
 */
const getCacheIntentTagType = (intent: string): string => {
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
 * 缓存意图标签文本
 */
const getCacheIntentLabel = (intent: string): string => {
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
 * 缓存来源标签类型
 */
const getCacheSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || 'primary'
}

/**
 * 缓存来源标签文本
 */
const getCacheSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    keyword: '关键词',
    ai: 'AI分类',
    default: '默认'
  }
  return map[source] || source
}

/**
 * 格式化缓存时间
 */
const formatCacheTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载缓存列表
 */
const loadCacheList = async () => {
  cacheLoading.value = true
  try {
    const res = await intentCacheApi.getList({
      intent: cacheFilterIntent.value,
      source: cacheFilterSource.value,
      page: cachePage.value,
      pageSize: cachePageSize.value
    })
    cacheList.value = res.data.data?.list || []
    cacheTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error('加载缓存列表失败')
  } finally {
    cacheLoading.value = false
  }
}

/**
 * 加载缓存统计
 */
const loadCacheStats = async () => {
  try {
    const res = await intentCacheApi.getStats()
    cacheStats.value = res.data.data || null
  } catch {
    // 忽略
  }
}

/**
 * 按条件清除缓存
 */
const handleClearCacheByFilter = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清除 ${cacheFilterIntent.value ? getCacheIntentLabel(cacheFilterIntent.value) + ' ' : ''}${cacheFilterSource.value ? getCacheSourceLabel(cacheFilterSource.value) + ' ' : ''}缓存吗？`,
      '确认清除',
      { type: 'warning' }
    )
    const res = await intentCacheApi.clear({
      intent: cacheFilterIntent.value,
      source: cacheFilterSource.value
    })
    ElMessage.success(`已清除 ${res.data.data?.cleared || 0} 条缓存`)
    await loadCacheAll()
  } catch {
    // 取消
  }
}

/**
 * 清除全部缓存
 */
const handleClearAllCache = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有意图缓存吗？此操作不可恢复。', '确认清除全部', {
      type: 'warning',
      confirmButtonText: '确定清除',
      confirmButtonClass: 'el-button--danger'
    })
    const res = await intentCacheApi.clearAll()
    ElMessage.success(`已清除 ${res.data.data?.cleared || 0} 条缓存`)
    await loadCacheAll()
  } catch {
    // 取消
  }
}

/**
 * 加载缓存所有数据
 */
const loadCacheAll = () => {
  loadCacheList()
  loadCacheStats()
}

onMounted(() => {
  loadCacheAll()
})
</script>
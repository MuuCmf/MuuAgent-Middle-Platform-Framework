<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 {{ $t('intentCache.helpTitle') }}</div>
    <ul>
      <li><strong>{{ $t('intentCache.helpItem1') }}</strong></li>
      <li><strong>{{ $t('intentCache.helpItem2') }}</strong></li>
      <li><strong>{{ $t('intentCache.helpItem3') }}</strong></li>
      <li><strong>{{ $t('intentCache.helpItem4') }}</strong></li>
    </ul>
  </div>

  <el-row :gutter="16" style="margin-bottom: 20px;">
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('intentCache.totalEntries')" :value="cacheStats?.total || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('intentCache.totalHits')" :value="cacheStats?.totalHits || 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('intentCache.intentTypes')" :value="cacheStats?.byIntent ? Object.keys(cacheStats.byIntent).length : 0" />
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="hover">
        <el-statistic :title="$t('intentCache.sourceTypes')" :value="cacheStats?.bySource ? Object.keys(cacheStats.bySource).length : 0" />
      </el-card>
    </el-col>
  </el-row>

  <div class="card">
    <div class="card-title">
      {{ $t('intentCache.list') }}
      <el-tag type="info" size="small">{{ cacheTotal }} {{ $t('intentCache.items') }}</el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="cacheFilterIntent" :placeholder="$t('intentCache.intentType')" clearable style="width: 140px;" @change="loadCacheAll">
        <el-option v-for="item in intentOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>

      <el-select v-model="cacheFilterSource" :placeholder="$t('intentCache.source')" clearable style="width: 140px;" @change="loadCacheAll">
        <el-option v-for="item in sourceOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>

      <el-button @click="loadCacheAll">
        <el-icon><Refresh /></el-icon>
        {{ $t('common.refresh') }}
      </el-button>

      <el-button type="warning" @click="handleClearCacheByFilter">
        <el-icon><Delete /></el-icon>
        {{ $t('intentCache.clearByFilter') }}
      </el-button>

      <el-button type="danger" @click="handleClearAllCache">
        <el-icon><Delete /></el-icon>
        {{ $t('intentCache.clearAll') }}
      </el-button>
    </div>

    <el-table :data="cacheList" stripe v-loading="cacheLoading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="intent" :label="$t('intentCache.intentType')" width="140">
        <template #default="{ row }">
          <el-tag :type="getCacheIntentTagType(row.intent)">{{ getIntentLabel(row.intent) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="source" :label="$t('intentCache.source')" width="120">
        <template #default="{ row }">
          <el-tag :type="getCacheSourceTagType(row.source)">{{ getSourceLabel(row.source) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="messageHash" :label="$t('intentCache.messageHash')" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <code style="font-size: 12px;">{{ row.messageHash }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="hitCount" :label="$t('intentCache.hitCount')" width="100" align="center" />
      <el-table-column prop="createdAt" :label="$t('intentCache.createTime')" width="170">
        <template #default="{ row }">
          {{ formatCacheTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="lastHitAt" :label="$t('intentCache.lastHitAt')" width="170">
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'
import { intentCacheApi, type IntentCacheItem, type CacheStats } from '@/api/intent-cache'

const { t } = useI18n()

const cacheList = ref<IntentCacheItem[]>([])
const cacheTotal = ref(0)
const cachePage = ref(1)
const cachePageSize = ref(20)
const cacheLoading = ref(false)
const cacheStats = ref<CacheStats | null>(null)

const cacheFilterIntent = ref<string>()
const cacheFilterSource = ref<string>()

const intentOptions = computed(() => [
  { label: `${t('intentLabel.general')}(general)`, value: 'general' },
  { label: `${t('intentLabel.code')}(code)`, value: 'code' },
  { label: `${t('intentLabel.math')}(math)`, value: 'math' },
  { label: `${t('intentLabel.creative')}(creative)`, value: 'creative' },
  { label: `${t('intentLabel.image')}(image)`, value: 'image' },
  { label: `${t('intentLabel.tts')}(tts)`, value: 'tts' },
  { label: `${t('intentLabel.asr')}(asr)`, value: 'asr' },
])

const sourceOptions = computed(() => [
  { label: `${t('sourceLabel.keyword')}(keyword)`, value: 'keyword' },
  { label: `${t('sourceLabel.ai')}(ai)`, value: 'ai' },
  { label: `${t('sourceLabel.default')}(default)`, value: 'default' },
])

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

const getCacheSourceTagType = (source: string): string => {
  const map: Record<string, string> = {
    keyword: 'success',
    ai: 'warning',
    default: 'info'
  }
  return map[source] || 'primary'
}

const getSourceLabel = (source: string): string => {
  const map: Record<string, string> = {
    keyword: t('sourceLabel.keyword'),
    ai: t('sourceLabel.ai'),
    default: t('sourceLabel.default')
  }
  return map[source] || source
}

const formatCacheTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

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
    ElMessage.error(t('intentCache.loadListFailed'))
  } finally {
    cacheLoading.value = false
  }
}

const loadCacheStats = async () => {
  try {
    const res = await intentCacheApi.getStats()
    cacheStats.value = res.data.data || null
  } catch {
    // ignore
  }
}

const handleClearCacheByFilter = async () => {
  try {
    await ElMessageBox.confirm(
      t('intentCache.confirmClearAll'),
      t('intentCache.confirmClearTitle'),
      { type: 'warning', confirmButtonText: t('intentCache.confirmClearButton') }
    )
    const res = await intentCacheApi.clear({
      intent: cacheFilterIntent.value,
      source: cacheFilterSource.value
    })
    ElMessage.success(t('intentCache.clearedCount', { count: res.data.data?.cleared || 0 }))
    await loadCacheAll()
  } catch {
    // cancelled
  }
}

const handleClearAllCache = async () => {
  try {
    await ElMessageBox.confirm(
      t('intentCache.confirmClearAll'),
      t('intentCache.confirmClearTitle'),
      {
        type: 'warning',
        confirmButtonText: t('intentCache.confirmClearButton'),
        confirmButtonClass: 'el-button--danger'
      }
    )
    const res = await intentCacheApi.clearAll()
    ElMessage.success(t('intentCache.clearedCount', { count: res.data.data?.cleared || 0 }))
    await loadCacheAll()
  } catch {
    // cancelled
  }
}

const loadCacheAll = () => {
  loadCacheList()
  loadCacheStats()
}

onMounted(() => {
  loadCacheAll()
})
</script>

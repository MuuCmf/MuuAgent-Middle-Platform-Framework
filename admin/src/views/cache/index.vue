<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('cache.title') }}</h1>
        <p class="page-description">{{ t('cache.description') }}</p>
      </div>
      <el-button @click="refreshAll" :loading="loading">
        <el-icon><Refresh /></el-icon>
        {{ t('cache.refresh') }}
      </el-button>
    </div>

    <!-- 1. 工具执行缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #667eea;">{{ t('cache.toolExecution.badge') }}</span>
        <span class="section-title">{{ t('cache.toolExecution.title') }}</span>
        <span class="section-meta">{{ t('cache.toolExecution.type') }}</span>
        <span class="section-meta">{{ t('cache.toolExecution.ttl') }} {{ (config.defaultTtl / 1000).toFixed(0) }}s</span>
        <span class="section-meta">{{ t('cache.toolExecution.capacity') }} {{ config.maxSize }}</span>
        <el-tag v-if="!config.enabled" type="danger" size="small">{{ t('cache.toolExecution.disabled') }}</el-tag>
        <span class="section-meta" style="margin-left: auto;">
          {{ t('cache.toolExecution.exclude') }}
          <el-tag v-for="t in config.excludeTools" :key="t" size="small" type="info" style="margin-left: 4px;">{{ t }}</el-tag>
        </span>
      </div>

      <el-row :gutter="12">
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.size }} / {{ stats.maxSize }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.items') }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value" :style="{ color: hitColor(stats.hitRate) }">{{ fmtPercent(stats.hitRate) }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.hitRate') }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.hits.toLocaleString() }} / {{ stats.misses.toLocaleString() }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.hitsMisses') }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.evictions }} / {{ stats.expirations }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.evictExpire') }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.totalRequests.toLocaleString() }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.totalRequests') }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ fmtMemory(stats.estimatedMemoryUsage) }}</div>
            <div class="metric-label">{{ t('cache.toolExecution.memoryUsage') }}</div>
          </div>
        </el-col>
      </el-row>

      <el-divider style="margin: 12px 0;" />
      <div class="section-actions">
        <span style="font-size: 12px; color: #909399; margin-right: 8px;">{{ autoRefreshHint }}</span>
        <el-button size="small" @click="handleCleanupExpired" :loading="cleanupLoading">
          {{ t('cache.toolExecution.cleanupExpired') }}
        </el-button>
        <el-button size="small" type="danger" @click="handleClearCache" :loading="clearLoading">
          {{ t('cache.toolExecution.clearCache') }}
        </el-button>
      </div>
    </div>

    <!-- 2. 技能缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #e6a23c;">{{ t('cache.skill.badge') }}</span>
        <span class="section-title">{{ t('cache.skill.title') }}</span>
        <span class="section-meta">{{ t('cache.skill.type') }}</span>
        <span class="section-meta" style="margin-left: auto;">
          <el-tag size="small">L1 {{ fmtDuration(overview?.skillCache.config?.L1_TTL) }}</el-tag>
          <el-tag size="small" type="warning" style="margin-left: 4px;">L2 {{ fmtDuration(overview?.skillCache.config?.L2_TTL) }}</el-tag>
          <el-tag size="small" type="info" style="margin-left: 4px;">L3 {{ fmtDuration(overview?.skillCache.config?.L3_TTL) }}</el-tag>
        </span>
      </div>

      <el-row :gutter="12">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value" :style="{ color: hitColor(overview?.skillCache.l2HitRate ?? 0) }">{{ fmtPercent(overview?.skillCache.l2HitRate ?? 0) }}</div>
            <div class="metric-label">{{ t('cache.skill.l2HitRate') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.l2MemKeys ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.skill.l2Items') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ (overview?.skillCache.l2Hits ?? 0).toLocaleString() }} / {{ (overview?.skillCache.l2Misses ?? 0).toLocaleString() }}</div>
            <div class="metric-label">{{ t('cache.skill.l2HitsMisses') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.l2Evictions ?? '-' }} / {{ overview?.skillCache.trackedRedisL2 ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.skill.l2EvictRedis') }}</div>
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="12" style="margin-top: 8px;">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL1 ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.skill.redisL1Meta') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL2 ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.skill.redisL2Desc') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL3 ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.skill.redisL3Doc') }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 3. MCP Server 缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #67c23a;">{{ t('cache.mcp.badge') }}</span>
        <span class="section-title">{{ t('cache.mcp.title') }}</span>
        <span class="section-meta">{{ t('cache.mcp.type') }}</span>
        <span class="section-meta">{{ t('cache.mcp.ttl') }} {{ fmtDuration(overview?.mcpServer.ttlMs) }}</span>
      </div>
      <el-row :gutter="12">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.mcpServer.keys ?? '-' }}</div>
            <div class="metric-label">{{ t('cache.mcp.items') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value" :class="{ 'metric-warn': (overview?.mcpServer.expiredCount ?? 0) > 0 }">{{ overview?.mcpServer.expiredCount ?? '0' }}</div>
            <div class="metric-label">{{ t('cache.mcp.expired') }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 4. 意图分类缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #909399;">{{ t('cache.intent.badge') }}</span>
        <span class="section-title">{{ t('cache.intent.title') }}</span>
        <span class="section-meta">{{ t('cache.intent.type') }}</span>
      </div>
      <el-row :gutter="12">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ (overview?.intentCache.keys ?? 0).toLocaleString() }}</div>
            <div class="metric-label">{{ t('cache.intent.records') }}</div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { agentApi, type ToolCacheStats, type ToolCacheConfig, type CacheOverview } from '@/api/agent'

const { t } = useI18n()
const loading = ref(false)
const overview = ref<CacheOverview | null>(null)
const cleanupLoading = ref(false)
const clearLoading = ref(false)

const stats = ref<ToolCacheStats>({ size: 0, maxSize: 500, hits: 0, misses: 0, hitRate: 0, evictions: 0, expirations: 0, totalRequests: 0, avgAccessCount: 0, estimatedMemoryUsage: 0 })
const config = ref<ToolCacheConfig>({ maxSize: 500, defaultTtl: 60000, enabled: true, excludeTools: [] })

let timer: NodeJS.Timeout | null = null

const autoRefreshHint = computed(() => t('cache.toolExecution.autoRefresh'))

// ---- formatters ----
const fmtPercent = (v: number) => v != null ? (v * 100).toFixed(1) + '%' : '-'
const fmtMemory = (b: number) => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(2) + ' MB' }
const fmtDuration = (ms?: number) => { if (!ms) return '-'; if (ms < 60000) return (ms / 1000).toFixed(0) + 's'; if (ms < 3600000) return (ms / 60000).toFixed(0) + 'min'; return (ms / 3600000).toFixed(1) + 'h' }
const hitColor = (r: number) => { if (!r) return '#909399'; if (r >= 0.7) return '#67c23a'; if (r >= 0.4) return '#e6a23c'; return '#f56c6c' }

// ---- data ----
const refreshAll = async () => {
  loading.value = true
  await Promise.all([loadOverview(), loadStats(), loadConfig()])
  loading.value = false
}

const loadOverview = async () => {
  try {
    const { data } = await agentApi.getCacheOverview()
    overview.value = data.data
  } catch { /* ignore */ }
}

const loadStats = async () => {
  try {
    const { data } = await agentApi.getCacheStats()
    stats.value = data.data
  } catch { /* ignore */ }
}

const loadConfig = async () => {
  try {
    const { data } = await agentApi.getCacheConfig()
    config.value = data.data
  } catch { /* ignore */ }
}

const handleCleanupExpired = async () => {
  try {
    cleanupLoading.value = true
    const { data } = await agentApi.cleanupExpiredCache()
    ElMessage.success(t('cache.message.cleanupSuccess', { count: data.data.cleanedCount }))
    await loadStats()
  } catch {
    ElMessage.error(t('cache.message.cleanupFailed'))
  } finally {
    cleanupLoading.value = false
  }
}

const handleClearCache = async () => {
  try {
    await ElMessageBox.confirm(t('cache.message.clearConfirm'), t('cache.message.clearWarning'), { confirmButtonText: t('cache.message.confirm'), cancelButtonText: t('cache.message.cancel'), type: 'warning' })
    clearLoading.value = true
    await agentApi.clearCache()
    ElMessage.success(t('cache.message.clearSuccess'))
    await Promise.all([loadStats(), loadOverview()])
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(t('cache.message.clearFailed'))
  } finally {
    clearLoading.value = false
  }
}

onMounted(() => {
  refreshAll()
  timer = setInterval(() => { loadOverview(); loadStats() }, 10000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 4px 0; }
.page-description { font-size: 13px; color: #909399; margin: 0; }

// ---- section header ----
.section-head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 22px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.section-title { font-size: 15px; font-weight: 600; color: #303133; }
.section-meta { font-size: 12px; color: #909399; }

// ---- metrics ----
.metric {
  padding: 10px 14px;
  background: #fafbfc;
  border-radius: 6px;
  text-align: center;
}
.metric-value { font-size: 17px; font-weight: 600; color: #303133; line-height: 1.4; }
.metric-label { font-size: 12px; color: #909399; margin-top: 2px; }
.metric-warn { color: #e6a23c !important; }

// ---- actions ----
.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.card { margin-bottom: 12px; }
</style>

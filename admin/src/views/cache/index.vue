<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">缓存监控</h1>
        <p class="page-description">覆盖工具执行、技能、MCP、意图分类四层缓存体系</p>
      </div>
      <el-button @click="refreshAll" :loading="loading">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 1. 工具执行缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #667eea;">工具</span>
        <span class="section-title">工具执行缓存</span>
        <span class="section-meta">Memory (LRU)</span>
        <span class="section-meta">TTL {{ (config.defaultTtl / 1000).toFixed(0) }}s</span>
        <span class="section-meta">容量 {{ config.maxSize }}</span>
        <el-tag v-if="!config.enabled" type="danger" size="small">已禁用</el-tag>
        <span class="section-meta" style="margin-left: auto;">
          排除：
          <el-tag v-for="t in config.excludeTools" :key="t" size="small" type="info" style="margin-left: 4px;">{{ t }}</el-tag>
        </span>
      </div>

      <el-row :gutter="12">
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.size }} / {{ stats.maxSize }}</div>
            <div class="metric-label">缓存项 / 上限</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value" :style="{ color: hitColor(stats.hitRate) }">{{ fmtPercent(stats.hitRate) }}</div>
            <div class="metric-label">命中率</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.hits.toLocaleString() }} / {{ stats.misses.toLocaleString() }}</div>
            <div class="metric-label">命中 / 未命中</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.evictions }} / {{ stats.expirations }}</div>
            <div class="metric-label">淘汰 / 过期</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ stats.totalRequests.toLocaleString() }}</div>
            <div class="metric-label">总请求数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric">
            <div class="metric-value">{{ fmtMemory(stats.estimatedMemoryUsage) }}</div>
            <div class="metric-label">内存估算</div>
          </div>
        </el-col>
      </el-row>

      <el-divider style="margin: 12px 0;" />
      <div class="section-actions">
        <span style="font-size: 12px; color: #909399; margin-right: 8px;">{{ autoRefreshHint }}</span>
        <el-button size="small" @click="handleCleanupExpired" :loading="cleanupLoading">
          清理过期
        </el-button>
        <el-button size="small" type="danger" @click="handleClearCache" :loading="clearLoading">
          清空工具缓存
        </el-button>
      </div>
    </div>

    <!-- 2. 技能缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #e6a23c;">技能</span>
        <span class="section-title">技能缓存</span>
        <span class="section-meta">Redis + Memory (L1 / L2 / L3)</span>
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
            <div class="metric-label">L2 内存命中率</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.l2MemKeys ?? '-' }}</div>
            <div class="metric-label">L2 内存条目</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ (overview?.skillCache.l2Hits ?? 0).toLocaleString() }} / {{ (overview?.skillCache.l2Misses ?? 0).toLocaleString() }}</div>
            <div class="metric-label">L2 命中 / 未命中</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.l2Evictions ?? '-' }} / {{ overview?.skillCache.trackedRedisL2 ?? '-' }}</div>
            <div class="metric-label">L2 淘汰 / Redis键</div>
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="12" style="margin-top: 8px;">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL1 ?? '-' }}</div>
            <div class="metric-label">Redis L1 元数据键</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL2 ?? '-' }}</div>
            <div class="metric-label">Redis L2 描述符键</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.skillCache.trackedRedisL3 ?? '-' }}</div>
            <div class="metric-label">Redis L3 文档键</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 3. MCP Server 缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #67c23a;">MCP</span>
        <span class="section-title">MCP Server 注册表</span>
        <span class="section-meta">Memory (Map)</span>
        <span class="section-meta">TTL {{ fmtDuration(overview?.mcpServer.ttlMs) }}</span>
      </div>
      <el-row :gutter="12">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ overview?.mcpServer.keys ?? '-' }}</div>
            <div class="metric-label">缓存条目</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value" :class="{ 'metric-warn': (overview?.mcpServer.expiredCount ?? 0) > 0 }">{{ overview?.mcpServer.expiredCount ?? '0' }}</div>
            <div class="metric-label">已过期</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 4. 意图分类缓存 -->
    <div class="card">
      <div class="section-head">
        <span class="badge" style="background: #909399;">意图</span>
        <span class="section-title">意图分类缓存</span>
        <span class="section-meta">MySQL (intentCache)</span>
      </div>
      <el-row :gutter="12">
        <el-col :span="6">
          <div class="metric">
            <div class="metric-value">{{ (overview?.intentCache.keys ?? 0).toLocaleString() }}</div>
            <div class="metric-label">持久化记录数</div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { agentApi, type ToolCacheStats, type ToolCacheConfig, type CacheOverview } from '@/api/agent'

const loading = ref(false)
const overview = ref<CacheOverview | null>(null)
const cleanupLoading = ref(false)
const clearLoading = ref(false)

const stats = ref<ToolCacheStats>({ size: 0, maxSize: 500, hits: 0, misses: 0, hitRate: 0, evictions: 0, expirations: 0, totalRequests: 0, avgAccessCount: 0, estimatedMemoryUsage: 0 })
const config = ref<ToolCacheConfig>({ maxSize: 500, defaultTtl: 60000, enabled: true, excludeTools: [] })

let timer: NodeJS.Timeout | null = null

const autoRefreshHint = computed(() => '每 10 秒自动刷新')

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
    ElMessage.success(`已清理 ${data.data.cleanedCount} 个过期缓存项`)
    await loadStats()
  } catch {
    ElMessage.error('清理失败')
  } finally {
    cleanupLoading.value = false
  }
}

const handleClearCache = async () => {
  try {
    await ElMessageBox.confirm('确定要清空工具执行缓存吗？', '警告', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    clearLoading.value = true
    await agentApi.clearCache()
    ElMessage.success('已清空')
    await Promise.all([loadStats(), loadOverview()])
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('清空失败')
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

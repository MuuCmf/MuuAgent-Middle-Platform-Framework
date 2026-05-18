<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">工具缓存管理</h1>
      <p class="page-description">监控和管理工具执行缓存，提升系统响应速度</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 缓存说明</div>
      <ul>
        <li><strong>LRU缓存</strong>：最近最少使用淘汰策略，自动清理不常用的缓存项</li>
        <li><strong>TTL过期</strong>：缓存项自动过期，默认60秒，可配置</li>
        <li><strong>命中率</strong>：缓存命中次数 / 总请求次数，越高表示缓存效果越好</li>
        <li><strong>淘汰次数</strong>：因容量限制被淘汰的缓存项数量</li>
      </ul>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <el-icon size="24"><Coin /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.size }} / {{ stats.maxSize }}</div>
            <div class="stat-label">缓存项数量</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <el-icon size="24"><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatPercent(stats.hitRate) }}</div>
            <div class="stat-label">缓存命中率</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <el-icon size="24"><Refresh /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalRequests.toLocaleString() }}</div>
            <div class="stat-label">总请求数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <el-icon size="24"><Cpu /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatMemory(stats.estimatedMemoryUsage) }}</div>
            <div class="stat-label">内存使用估算</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="缓存统计" name="stats">
        <div class="card">
          <div class="card-title">
            统计详情
            <el-button size="small" @click="loadStats" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <el-descriptions :column="3" border>
            <el-descriptions-item label="命中次数">
              <el-tag type="success">{{ stats.hits.toLocaleString() }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="未命中次数">
              <el-tag type="warning">{{ stats.misses.toLocaleString() }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="命中率">
              <el-progress 
                :percentage="stats.hitRate * 100" 
                :format="() => formatPercent(stats.hitRate)"
                :color="getHitRateColor(stats.hitRate)"
              />
            </el-descriptions-item>
            <el-descriptions-item label="淘汰次数">
              <el-tag type="info">{{ stats.evictions }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="过期清理次数">
              <el-tag type="info">{{ stats.expirations }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="平均访问次数">
              {{ stats.avgAccessCount.toFixed(2) }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="card" style="margin-top: 16px;">
          <div class="card-title">缓存操作</div>
          
          <el-space>
            <el-button type="primary" @click="handleCleanupExpired" :loading="cleanupLoading">
              <el-icon><Delete /></el-icon>
              清理过期缓存
            </el-button>
            <el-button type="danger" @click="handleClearCache" :loading="clearLoading">
              <el-icon><Close /></el-icon>
              清空全部缓存
            </el-button>
          </el-space>
        </div>
      </el-tab-pane>

      <el-tab-pane label="缓存配置" name="config">
        <div class="card">
          <div class="card-title">
            当前配置
            <el-button size="small" @click="loadConfig" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="缓存状态">
              <el-tag :type="config.enabled ? 'success' : 'danger'">
                {{ config.enabled ? '已启用' : '已禁用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最大缓存项数量">
              {{ config.maxSize }}
            </el-descriptions-item>
            <el-descriptions-item label="默认TTL">
              {{ (config.defaultTtl / 1000).toFixed(1) }} 秒
            </el-descriptions-item>
            <el-descriptions-item label="不缓存的工具">
              <template v-if="config.excludeTools.length">
                <el-tag 
                  v-for="tool in config.excludeTools" 
                  :key="tool" 
                  type="warning" 
                  size="small"
                  style="margin-right: 4px;"
                >
                  {{ tool }}
                </el-tag>
              </template>
              <span v-else style="color: #999;">无</span>
            </el-descriptions-item>
          </el-descriptions>

          <div class="help-tip" style="margin-top: 16px;">
            <div class="help-tip-title">📝 配置说明</div>
            <ul>
              <li><strong>最大缓存项数量</strong>：缓存最多保存的条目数，超出时使用LRU淘汰</li>
              <li><strong>默认TTL</strong>：缓存项的默认过期时间，过期后自动清理</li>
              <li><strong>不缓存的工具</strong>：这些工具的执行结果不会被缓存，适用于结果经常变化的工具</li>
            </ul>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, TrendCharts, Refresh, Cpu, Delete, Close } from '@element-plus/icons-vue'
import { agentApi, type ToolCacheStats, type ToolCacheConfig } from '@/api/agent'

const activeTab = ref('stats')

const stats = ref<ToolCacheStats>({
  size: 0,
  maxSize: 500,
  hits: 0,
  misses: 0,
  hitRate: 0,
  evictions: 0,
  expirations: 0,
  totalRequests: 0,
  avgAccessCount: 0,
  estimatedMemoryUsage: 0,
})

const config = ref<ToolCacheConfig>({
  maxSize: 500,
  defaultTtl: 60000,
  enabled: true,
  excludeTools: [],
})

const cleanupLoading = ref(false)
const clearLoading = ref(false)

let refreshTimer: NodeJS.Timeout | null = null

const formatPercent = (value: number): string => {
  return (value * 100).toFixed(1) + '%'
}

const formatMemory = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const getHitRateColor = (rate: number): string => {
  if (rate >= 0.7) return '#67c23a'
  if (rate >= 0.4) return '#e6a23c'
  return '#f56c6c'
}

const loadStats = async () => {
  try {
    const { data } = await agentApi.getCacheStats()
    stats.value = data.data
  } catch (error) {
    console.error('加载缓存统计失败', error)
  }
}

const loadConfig = async () => {
  try {
    const { data } = await agentApi.getCacheConfig()
    config.value = data.data
  } catch (error) {
    console.error('加载缓存配置失败', error)
  }
}

const handleCleanupExpired = async () => {
  try {
    cleanupLoading.value = true
    const { data } = await agentApi.cleanupExpiredCache()
    ElMessage.success(`已清理 ${data.data.cleanedCount} 个过期缓存项`)
    loadStats()
  } catch (error) {
    ElMessage.error('清理过期缓存失败')
  } finally {
    cleanupLoading.value = false
  }
}

const handleClearCache = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有缓存吗？这可能会暂时影响系统性能。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    clearLoading.value = true
    await agentApi.clearCache()
    ElMessage.success('缓存已清空')
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空缓存失败')
    }
  } finally {
    clearLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadConfig()
  
  refreshTimer = setInterval(() => {
    loadStats()
  }, 10000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style lang="scss" scoped>
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    margin-right: 16px;
  }

  .stat-content {
    flex: 1;

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-top: 4px;
    }
  }
}

.config-tabs {
  margin-top: 16px;
}

.card-title {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
}
</style>

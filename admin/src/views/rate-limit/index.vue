<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">⚡ 熔断限流配置</h1>
      <p class="page-description">配置系统的熔断和限流规则，保障系统稳定性和高可用性</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 功能说明</div>
      <ul>
        <li><strong>限流</strong>：控制请求速率，防止系统过载，支持QPS、并发、每日限额三种策略</li>
        <li><strong>熔断</strong>：自动检测故障并快速失败，防止级联故障，支持自动恢复</li>
        <li><strong>多级限流</strong>：支持全局、应用、接口、模型四个级别的限流配置</li>
      </ul>
    </div>

    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="限流配置" name="rateLimit">
        <div class="card">
          <div class="card-title">
            限流规则
            <el-tag type="info" size="small">{{ rateLimitRules.length }} 条</el-tag>
          </div>
          
          <el-space style="margin-bottom: 16px;">
            <el-button type="primary" @click="handleAddRateLimit">
              <el-icon><Plus /></el-icon>
              添加规则
            </el-button>
            <el-button @click="handleInitDefaultRules" :loading="initLoading">
              初始化默认规则
            </el-button>
            <el-button @click="loadRateLimitRules">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </el-space>

          <el-table :data="rateLimitRules" stripe v-loading="rateLimitLoading">
            <el-table-column prop="level" label="限流级别" width="120">
              <template #default="{ row }">
                <el-tag :type="getLevelTagType(row.level)">
                  {{ getLevelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target" label="限流目标" />
            <el-table-column prop="qpsLimit" label="QPS限制" width="100" />
            <el-table-column prop="concurrentLimit" label="并发限制" width="100" />
            <el-table-column prop="dailyLimit" label="每日限额" width="120" />
            <el-table-column prop="burstSize" label="突发流量" width="100" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'danger'">
                  {{ row.status ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditRateLimit(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="card" style="margin-top: 16px;">
          <div class="card-title">
            限流统计
            <el-button size="small" @click="loadRateLimitStatistics" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
          
          <el-table :data="rateLimitStatistics" stripe v-loading="statisticsLoading">
            <el-table-column prop="level" label="限流级别" width="120">
              <template #default="{ row }">
                <el-tag :type="getLevelTagType(row.level)">
                  {{ getLevelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target" label="限流目标" />
            <el-table-column label="当前QPS / 限制" width="150">
              <template #default="{ row }">
                {{ row.currentQps }} / {{ row.qpsLimit }}
              </template>
            </el-table-column>
            <el-table-column label="当前并发 / 限制" width="150">
              <template #default="{ row }">
                {{ row.currentConcurrent }} / {{ row.concurrentLimit }}
              </template>
            </el-table-column>
            <el-table-column label="今日调用 / 每日限额" width="180">
              <template #default="{ row }">
                {{ row.todayCount }} / {{ row.dailyLimit }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="熔断配置" name="circuitBreaker">
        <div class="card">
          <div class="card-title">
            熔断规则
            <el-tag type="info" size="small">{{ mcpRules.length }} 条</el-tag>
          </div>
          
          <el-button type="primary" @click="handleAddMcpRule" style="margin-bottom: 16px;">
            <el-icon><Plus /></el-icon>
            添加规则
          </el-button>

          <el-table :data="mcpRules" stripe v-loading="mcpLoading">
            <el-table-column prop="modelId" label="模型">
              <template #default="{ row }">
                {{ row.model?.name || row.modelId }}
              </template>
            </el-table-column>
            <el-table-column prop="qpsLimit" label="QPS限制" width="100" />
            <el-table-column prop="maxConcurrent" label="最大并发" width="100" />
            <el-table-column prop="currentConcurrent" label="当前并发" width="100" />
            <el-table-column prop="circuitStatus" label="熔断状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getCircuitStatusTagType(row.circuitStatus)">
                  {{ getCircuitStatusLabel(row.circuitStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorCount" label="错误次数" width="100" />
            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditMcpRule(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteMcpRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="card" style="margin-top: 16px;">
          <div class="card-title">
            熔断状态
            <el-button size="small" @click="loadMcpStatus" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
          
          <el-table :data="mcpStatus" stripe v-loading="statusLoading">
            <el-table-column prop="modelName" label="模型" />
            <el-table-column prop="circuitStatus" label="熔断状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getCircuitStatusTagType(row.circuitStatus)">
                  {{ getCircuitStatusLabel(row.circuitStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="failureCount" label="失败次数" width="100" />
            <el-table-column prop="successCount" label="成功次数" width="100" />
            <el-table-column prop="lastErrorTime" label="最后失败时间" width="180">
              <template #default="{ row }">
                {{ row.lastErrorTime ? new Date(row.lastErrorTime).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="nextRetryTime" label="下次重试时间" width="180">
              <template #default="{ row }">
                {{ row.nextRetryTime ? new Date(row.nextRetryTime).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <el-button 
                  size="small" 
                  type="warning" 
                  @click="handleResetMcpStatus(row.modelId)"
                  :disabled="row.circuitStatus === 'closed'"
                >
                  重置
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="黑名单" name="blacklist">
        <div class="card">
          <div class="card-title">IP黑名单</div>
          
          <el-button type="primary" @click="handleAddBlacklist" style="margin-bottom: 16px;">
            <el-icon><Plus /></el-icon>
            添加黑名单
          </el-button>

          <el-empty description="暂无黑名单数据" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog 
      v-model="rateLimitDialogVisible" 
      :title="editingRateLimit ? '编辑限流规则' : '添加限流规则'" 
      width="600px"
    >
      <el-form :model="rateLimitForm" label-width="120px">
        <el-form-item label="限流级别" required>
          <el-select v-model="rateLimitForm.level" style="width: 100%;">
            <el-option label="全局" value="global" />
            <el-option label="应用级" value="app" />
            <el-option label="接口级" value="interface" />
            <el-option label="模型级" value="model" />
          </el-select>
        </el-form-item>

        <el-form-item label="限流目标" required>
          <el-input 
            v-model="rateLimitForm.target" 
            :placeholder="getTargetPlaceholder()"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="QPS限制">
              <el-input-number v-model="rateLimitForm.qpsLimit" :min="1" :max="10000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="并发限制">
              <el-input-number v-model="rateLimitForm.concurrentLimit" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="每日限额">
              <el-input-number v-model="rateLimitForm.dailyLimit" :min="1" :max="10000000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="突发流量">
              <el-input-number v-model="rateLimitForm.burstSize" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="启用队列">
          <el-switch v-model="rateLimitForm.enableQueue" />
        </el-form-item>

        <template v-if="rateLimitForm.enableQueue">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="队列大小">
                <el-input-number v-model="rateLimitForm.queueSize" :min="1" :max="10000" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="队列超时(ms)">
                <el-input-number v-model="rateLimitForm.queueTimeout" :min="1000" :max="60000" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="rateLimitDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRateLimit" :loading="saveLoading">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog 
      v-model="mcpDialogVisible" 
      :title="editingMcpRule ? '编辑熔断规则' : '添加熔断规则'" 
      width="500px"
    >
      <el-form :model="mcpForm" label-width="120px">
        <el-form-item label="模型ID" required>
          <el-input v-model="mcpForm.modelId" placeholder="请输入模型ID" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="QPS限制">
              <el-input-number v-model="mcpForm.qpsLimit" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大并发">
              <el-input-number v-model="mcpForm.maxConcurrent" :min="1" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="mcpDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveMcpRule" :loading="saveLoading">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="blacklistDialogVisible" title="添加IP到黑名单" width="400px">
      <el-form :model="blacklistForm" label-width="100px">
        <el-form-item label="客户端IP" required>
          <el-input v-model="blacklistForm.clientIp" placeholder="如：192.168.1.100" />
        </el-form-item>
        <el-form-item label="封禁原因" required>
          <el-input v-model="blacklistForm.reason" placeholder="请输入封禁原因" />
        </el-form-item>
        <el-form-item label="封禁时长(秒)">
          <el-input-number v-model="blacklistForm.duration" :min="60" :max="86400" style="width: 100%;" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="blacklistDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveBlacklist" :loading="saveLoading">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { 
  rateLimitApi, 
  mcpApi, 
  type RateLimitRule, 
  type RateLimitRuleForm,
  type RateLimitStatistics,
  type McpRule,
  type McpRuleForm,
  type McpStatus,
  type BlacklistItem
} from '@/api/rateLimit'

const activeTab = ref('rateLimit')

const rateLimitLoading = ref(false)
const statisticsLoading = ref(false)
const mcpLoading = ref(false)
const statusLoading = ref(false)
const saveLoading = ref(false)
const initLoading = ref(false)

const rateLimitRules = ref<RateLimitRule[]>([])
const rateLimitStatistics = ref<RateLimitStatistics[]>([])
const mcpRules = ref<McpRule[]>([])
const mcpStatus = ref<McpStatus[]>([])

const rateLimitDialogVisible = ref(false)
const mcpDialogVisible = ref(false)
const blacklistDialogVisible = ref(false)

const editingRateLimit = ref<RateLimitRule | null>(null)
const editingMcpRule = ref<McpRule | null>(null)

const rateLimitForm = ref<RateLimitRuleForm>({
  level: 'interface',
  target: '',
  qpsLimit: 100,
  concurrentLimit: 50,
  dailyLimit: 10000,
  burstSize: 150,
  enableQueue: false,
  queueSize: 100,
  queueTimeout: 5000
})

const mcpForm = ref<McpRuleForm>({
  modelId: '',
  qpsLimit: 10,
  maxConcurrent: 5
})

const blacklistForm = ref<BlacklistItem>({
  clientIp: '',
  reason: '',
  duration: 3600
})

const getLevelLabel = (level: string) => {
  const labels: Record<string, string> = {
    global: '全局',
    app: '应用级',
    interface: '接口级',
    model: '模型级'
  }
  return labels[level] || level
}

const getLevelTagType = (level: string) => {
  const types: Record<string, any> = {
    global: 'danger',
    app: 'warning',
    interface: 'success',
    model: 'info'
  }
  return types[level] || ''
}

const getCircuitStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    closed: '关闭',
    open: '打开',
    half_open: '半开'
  }
  return labels[status] || status
}

const getCircuitStatusTagType = (status: string) => {
  const types: Record<string, any> = {
    closed: 'success',
    open: 'danger',
    half_open: 'warning'
  }
  return types[status] || ''
}

const getTargetPlaceholder = () => {
  const placeholders: Record<string, string> = {
    global: '固定值：global',
    app: '应用标识，如：app-001',
    interface: '接口路径，如：/api/ai/invoke',
    model: '模型ID'
  }
  return placeholders[rateLimitForm.value.level] || ''
}

const loadRateLimitRules = async () => {
  rateLimitLoading.value = true
  try {
    const { data } = await rateLimitApi.getRules()
    rateLimitRules.value = data.data || []
  } catch (error) {
    ElMessage.error('加载限流规则失败')
  } finally {
    rateLimitLoading.value = false
  }
}

const loadRateLimitStatistics = async () => {
  statisticsLoading.value = true
  try {
    const { data } = await rateLimitApi.getStatistics()
    rateLimitStatistics.value = data.data || []
  } catch (error) {
    ElMessage.error('加载限流统计失败')
  } finally {
    statisticsLoading.value = false
  }
}

const loadMcpRules = async () => {
  mcpLoading.value = true
  try {
    const { data } = await mcpApi.getRules()
    mcpRules.value = data.data || []
  } catch (error) {
    ElMessage.error('加载熔断规则失败')
  } finally {
    mcpLoading.value = false
  }
}

const loadMcpStatus = async () => {
  statusLoading.value = true
  try {
    const { data } = await mcpApi.getStatus()
    mcpStatus.value = data.data || []
  } catch (error) {
    ElMessage.error('加载熔断状态失败')
  } finally {
    statusLoading.value = false
  }
}

const handleAddRateLimit = () => {
  editingRateLimit.value = null
  rateLimitForm.value = {
    level: 'interface',
    target: '',
    qpsLimit: 100,
    concurrentLimit: 50,
    dailyLimit: 10000,
    burstSize: 150,
    enableQueue: false,
    queueSize: 100,
    queueTimeout: 5000
  }
  rateLimitDialogVisible.value = true
}

const handleEditRateLimit = (row: RateLimitRule) => {
  editingRateLimit.value = row
  rateLimitForm.value = {
    level: row.level,
    target: row.target,
    qpsLimit: row.qpsLimit,
    concurrentLimit: row.concurrentLimit,
    dailyLimit: row.dailyLimit,
    burstSize: row.burstSize,
    enableQueue: row.enableQueue,
    queueSize: row.queueSize,
    queueTimeout: row.queueTimeout
  }
  rateLimitDialogVisible.value = true
}

const handleSaveRateLimit = async () => {
  saveLoading.value = true
  try {
    await rateLimitApi.upsertRule(rateLimitForm.value)
    ElMessage.success('保存成功')
    rateLimitDialogVisible.value = false
    loadRateLimitRules()
    loadRateLimitStatistics()
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saveLoading.value = false
  }
}

const handleInitDefaultRules = async () => {
  try {
    await ElMessageBox.confirm('这将初始化默认的限流规则，是否继续？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    initLoading.value = true
    await rateLimitApi.initDefaultRules()
    ElMessage.success('初始化成功')
    loadRateLimitRules()
    loadRateLimitStatistics()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('初始化失败')
    }
  } finally {
    initLoading.value = false
  }
}

const handleAddMcpRule = () => {
  editingMcpRule.value = null
  mcpForm.value = {
    modelId: '',
    qpsLimit: 10,
    maxConcurrent: 5
  }
  mcpDialogVisible.value = true
}

const handleEditMcpRule = (row: McpRule) => {
  editingMcpRule.value = row
  mcpForm.value = {
    modelId: row.modelId,
    qpsLimit: row.qpsLimit,
    maxConcurrent: row.maxConcurrent
  }
  mcpDialogVisible.value = true
}

const handleSaveMcpRule = async () => {
  saveLoading.value = true
  try {
    await mcpApi.upsertRule(mcpForm.value)
    ElMessage.success('保存成功')
    mcpDialogVisible.value = false
    loadMcpRules()
    loadMcpStatus()
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saveLoading.value = false
  }
}

const handleDeleteMcpRule = async (row: McpRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模型「${row.model?.name || row.modelId}」的熔断规则吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await mcpApi.deleteRule(row.modelId)
    ElMessage.success('删除成功')
    loadMcpRules()
    loadMcpStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleResetMcpStatus = async (modelId: string) => {
  try {
    await ElMessageBox.confirm('确定要重置该模型的熔断状态吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await mcpApi.resetStatus(modelId)
    ElMessage.success('重置成功')
    loadMcpStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重置失败')
    }
  }
}

const handleAddBlacklist = () => {
  blacklistForm.value = {
    clientIp: '',
    reason: '',
    duration: 3600
  }
  blacklistDialogVisible.value = true
}

const handleSaveBlacklist = async () => {
  saveLoading.value = true
  try {
    await rateLimitApi.addToBlacklist(blacklistForm.value)
    ElMessage.success('添加成功')
    blacklistDialogVisible.value = false
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    saveLoading.value = false
  }
}

onMounted(() => {
  loadRateLimitRules()
  loadRateLimitStatistics()
  loadMcpRules()
  loadMcpStatus()
})
</script>

<style scoped lang="scss">
.config-tabs {
  :deep(.el-tabs__content) {
    padding: 0;
  }
}
</style>

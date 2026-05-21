<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('rateLimit.title') }}</h1>
      <p class="page-description">{{ t('rateLimit.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ t('rateLimit.helpTip.title') }}</div>
      <ul>
        <li><strong>{{ t('rateLimit.helpTip.rateLimit').split('：')[0] }}</strong>：{{ t('rateLimit.helpTip.rateLimit').split('：')[1] }}</li>
        <li><strong>{{ t('rateLimit.helpTip.circuitBreaker').split('：')[0] }}</strong>：{{ t('rateLimit.helpTip.circuitBreaker').split('：')[1] }}</li>
        <li><strong>{{ t('rateLimit.helpTip.multiLevel').split('：')[0] }}</strong>：{{ t('rateLimit.helpTip.multiLevel').split('：')[1] }}</li>
      </ul>
    </div>

    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane :label="t('rateLimit.tabs.rateLimit')" name="rateLimit">
        <div class="card">
          <div class="card-title">
            {{ t('rateLimit.rateLimitSection.rulesTitle') }}
            <el-tag type="info" size="small">{{ t('rateLimit.rateLimitSection.rulesCount', { count: rateLimitRules.length }) }}</el-tag>
          </div>
          
          <el-space style="margin-bottom: 16px;">
            <el-button type="primary" @click="handleAddRateLimit">
              <el-icon><Plus /></el-icon>
              {{ t('rateLimit.rateLimitSection.addRule') }}
            </el-button>
            <el-button @click="handleInitDefaultRules" :loading="initLoading">
              {{ t('rateLimit.rateLimitSection.initDefaultRules') }}
            </el-button>
            <el-button @click="loadRateLimitRules">
              <el-icon><Refresh /></el-icon>
              {{ t('rateLimit.rateLimitSection.refresh') }}
            </el-button>
          </el-space>

          <el-table :data="rateLimitRules" stripe v-loading="rateLimitLoading">
            <el-table-column prop="level" :label="t('rateLimit.rateLimitSection.levelColumn')" width="120">
              <template #default="{ row }">
                <el-tag :type="getLevelTagType(row.level)">
                  {{ t(`rateLimit.levelLabels.${row.level}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target" :label="t('rateLimit.rateLimitSection.targetColumn')" />
            <el-table-column prop="qpsLimit" :label="t('rateLimit.rateLimitSection.qpsLimitColumn')" width="100" />
            <el-table-column prop="concurrentLimit" :label="t('rateLimit.rateLimitSection.concurrentLimitColumn')" width="100" />
            <el-table-column prop="dailyLimit" :label="t('rateLimit.rateLimitSection.dailyLimitColumn')" width="120" />
            <el-table-column prop="burstSize" :label="t('rateLimit.rateLimitSection.burstSizeColumn')" width="100" />
            <el-table-column prop="status" :label="t('rateLimit.rateLimitSection.statusColumn')" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'danger'">
                  {{ row.status ? t('rateLimit.rateLimitSection.enabled') : t('rateLimit.rateLimitSection.disabled') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('rateLimit.rateLimitSection.operationColumn')" width="120" align="right">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="handleEditRateLimit(row)">{{ t('rateLimit.rateLimitSection.edit') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="card" style="margin-top: 16px;">
          <div class="card-title">
            {{ t('rateLimit.rateLimitSection.statisticsTitle') }}
            <el-button size="small" @click="loadRateLimitStatistics" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              {{ t('rateLimit.rateLimitSection.refresh') }}
            </el-button>
          </div>
          
          <el-table :data="rateLimitStatistics" stripe v-loading="statisticsLoading">
            <el-table-column prop="level" :label="t('rateLimit.rateLimitSection.levelColumn')" width="120">
              <template #default="{ row }">
                <el-tag :type="getLevelTagType(row.level)">
                  {{ t(`rateLimit.levelLabels.${row.level}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target" :label="t('rateLimit.rateLimitSection.targetColumn')" />
            <el-table-column :label="t('rateLimit.rateLimitSection.currentQpsLabel')" width="150">
              <template #default="{ row }">
                {{ row.currentQps }} / {{ row.qpsLimit }}
              </template>
            </el-table-column>
            <el-table-column :label="t('rateLimit.rateLimitSection.currentConcurrentLabel')" width="150">
              <template #default="{ row }">
                {{ row.currentConcurrent }} / {{ row.concurrentLimit }}
              </template>
            </el-table-column>
            <el-table-column :label="t('rateLimit.rateLimitSection.todayCountLabel')" width="180">
              <template #default="{ row }">
                {{ row.todayCount }} / {{ row.dailyLimit }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('rateLimit.tabs.circuitBreaker')" name="circuitBreaker">
        <div class="card">
          <div class="card-title">
            {{ t('rateLimit.circuitBreakerSection.rulesTitle') }}
            <el-tag type="info" size="small">{{ t('rateLimit.circuitBreakerSection.rulesCount', { count: routingRules.length }) }}</el-tag>
          </div>
          
          <el-button type="primary" @click="handleAddModelRoutingRule" style="margin-bottom: 16px;">
            <el-icon><Plus /></el-icon>
            {{ t('rateLimit.circuitBreakerSection.addRule') }}
          </el-button>

          <el-table :data="routingRules" stripe v-loading="routingLoading">
            <el-table-column prop="modelId" :label="t('rateLimit.circuitBreakerSection.modelColumn')">
              <template #default="{ row }">
                {{ row.model?.name || row.modelId }}
              </template>
            </el-table-column>
            <el-table-column prop="qpsLimit" :label="t('rateLimit.circuitBreakerSection.qpsLimitColumn')" width="100" />
            <el-table-column prop="maxConcurrent" :label="t('rateLimit.circuitBreakerSection.maxConcurrentColumn')" width="100" />
            <el-table-column prop="currentConcurrent" :label="t('rateLimit.circuitBreakerSection.currentConcurrentColumn')" width="100" />
            <el-table-column prop="circuitStatus" :label="t('rateLimit.circuitBreakerSection.circuitStatusColumn')" width="100">
              <template #default="{ row }">
                <el-tag :type="getCircuitStatusTagType(row.circuitStatus)">
                  {{ t(`rateLimit.circuitStatusLabels.${row.circuitStatus}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorCount" :label="t('rateLimit.circuitBreakerSection.errorCountColumn')" width="100" />
            <el-table-column :label="t('rateLimit.circuitBreakerSection.operationColumn')" width="180" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditModelRoutingRule(row)">{{ t('rateLimit.circuitBreakerSection.edit') }}</el-button>
                <el-button size="small" type="danger" @click="handleDeleteModelRoutingRule(row)">{{ t('rateLimit.circuitBreakerSection.delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="card" style="margin-top: 16px;">
          <div class="card-title">
            {{ t('rateLimit.circuitBreakerSection.statusTitle') }}
            <el-button size="small" @click="loadModelRoutingStatus" style="margin-left: auto;">
              <el-icon><Refresh /></el-icon>
              {{ t('rateLimit.circuitBreakerSection.refresh') }}
            </el-button>
          </div>
          
          <el-table :data="routingStatus" stripe v-loading="statusLoading">
            <el-table-column prop="modelName" :label="t('rateLimit.circuitBreakerSection.modelColumn')" />
            <el-table-column prop="circuitStatus" :label="t('rateLimit.circuitBreakerSection.circuitStatusColumn')" width="120">
              <template #default="{ row }">
                <el-tag :type="getCircuitStatusTagType(row.circuitStatus)">
                  {{ t(`rateLimit.circuitStatusLabels.${row.circuitStatus}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="failureCount" :label="t('rateLimit.circuitBreakerSection.failureCountColumn')" width="100" />
            <el-table-column prop="successCount" :label="t('rateLimit.circuitBreakerSection.successCountColumn')" width="100" />
            <el-table-column prop="lastErrorTime" :label="t('rateLimit.circuitBreakerSection.lastErrorTimeColumn')" width="180">
              <template #default="{ row }">
                {{ row.lastErrorTime ? new Date(row.lastErrorTime).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="nextRetryTime" :label="t('rateLimit.circuitBreakerSection.nextRetryTimeColumn')" width="180">
              <template #default="{ row }">
                {{ row.nextRetryTime ? new Date(row.nextRetryTime).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column :label="t('rateLimit.circuitBreakerSection.operationColumn')" width="120" align="right">
              <template #default="{ row }">
                <el-button 
                  size="small" 
                  type="warning" 
                  @click="handleResetModelRoutingStatus(row.modelId)"
                  :disabled="row.circuitStatus === 'closed'"
                >
                  {{ t('rateLimit.circuitBreakerSection.reset') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('rateLimit.tabs.blacklist')" name="blacklist">
        <div class="card">
          <div class="card-title">{{ t('rateLimit.blacklistSection.title') }}</div>
          
          <el-button type="primary" @click="handleAddBlacklist" style="margin-bottom: 16px;">
            <el-icon><Plus /></el-icon>
            {{ t('rateLimit.blacklistSection.addBlacklist') }}
          </el-button>

          <el-empty :description="t('rateLimit.blacklistSection.emptyDescription')" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog 
      v-model="rateLimitDialogVisible" 
      :title="editingRateLimit ? t('rateLimit.dialog.editRateLimitRule') : t('rateLimit.dialog.addRateLimitRule')" 
      width="600px"
    >
      <el-form :model="rateLimitForm" label-width="120px">
        <el-form-item :label="t('rateLimit.dialog.levelLabel')" required>
          <el-select v-model="rateLimitForm.level" style="width: 100%;">
            <el-option :label="t('rateLimit.dialog.globalOption')" value="global" />
            <el-option :label="t('rateLimit.dialog.appOption')" value="app" />
            <el-option :label="t('rateLimit.dialog.interfaceOption')" value="interface" />
            <el-option :label="t('rateLimit.dialog.modelOption')" value="model" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('rateLimit.dialog.targetLabel')" required>
          <el-input 
            v-model="rateLimitForm.target" 
            :placeholder="getTargetPlaceholder()"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.qpsLimitLabel')">
              <el-input-number v-model="rateLimitForm.qpsLimit" :min="1" :max="10000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.concurrentLimitLabel')">
              <el-input-number v-model="rateLimitForm.concurrentLimit" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.dailyLimitLabel')">
              <el-input-number v-model="rateLimitForm.dailyLimit" :min="1" :max="10000000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.burstSizeLabel')">
              <el-input-number v-model="rateLimitForm.burstSize" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('rateLimit.dialog.enableQueueLabel')">
          <el-switch v-model="rateLimitForm.enableQueue" />
        </el-form-item>

        <template v-if="rateLimitForm.enableQueue">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item :label="t('rateLimit.dialog.queueSizeLabel')">
                <el-input-number v-model="rateLimitForm.queueSize" :min="1" :max="10000" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="t('rateLimit.dialog.queueTimeoutLabel')">
                <el-input-number v-model="rateLimitForm.queueTimeout" :min="1000" :max="60000" style="width: 100%;" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="rateLimitDialogVisible = false">{{ t('rateLimit.dialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveRateLimit" :loading="saveLoading">{{ t('rateLimit.dialog.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog 
      v-model="routingDialogVisible" 
      :title="editingModelRoutingRule ? t('rateLimit.dialog.editCircuitBreakerRule') : t('rateLimit.dialog.addCircuitBreakerRule')" 
      width="500px"
    >
      <el-form :model="routingForm" label-width="120px">
        <el-form-item :label="t('rateLimit.dialog.modelIdLabel')" required>
          <el-input v-model="routingForm.modelId" :placeholder="t('rateLimit.dialog.modelIdPlaceholder')" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.qpsLimitLabel')">
              <el-input-number v-model="routingForm.qpsLimit" :min="1" :max="1000" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('rateLimit.dialog.maxConcurrentLabel')">
              <el-input-number v-model="routingForm.maxConcurrent" :min="1" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="routingDialogVisible = false">{{ t('rateLimit.dialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveModelRoutingRule" :loading="saveLoading">{{ t('rateLimit.dialog.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="blacklistDialogVisible" :title="t('rateLimit.dialog.addToBlacklist')" width="400px">
      <el-form :model="blacklistForm" label-width="100px">
        <el-form-item :label="t('rateLimit.dialog.clientIpLabel')" required>
          <el-input v-model="blacklistForm.clientIp" :placeholder="t('rateLimit.dialog.clientIpPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('rateLimit.dialog.reasonLabel')" required>
          <el-input v-model="blacklistForm.reason" :placeholder="t('rateLimit.dialog.reasonPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('rateLimit.dialog.durationLabel')">
          <el-input-number v-model="blacklistForm.duration" :min="60" :max="86400" style="width: 100%;" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="blacklistDialogVisible = false">{{ t('rateLimit.dialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveBlacklist" :loading="saveLoading">{{ t('rateLimit.dialog.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { 
  rateLimitApi, 
  circuitBreakerApi, 
  type RateLimitRule, 
  type RateLimitRuleForm,
  type RateLimitStatistics,
  type ModelRoutingRule,
  type ModelRoutingRuleForm,
  type ModelRoutingStatus,
  type BlacklistItem
} from '@/api/rateLimit'

const { t } = useI18n()

const activeTab = ref('rateLimit')

const rateLimitLoading = ref(false)
const statisticsLoading = ref(false)
const routingLoading = ref(false)
const statusLoading = ref(false)
const saveLoading = ref(false)
const initLoading = ref(false)

const rateLimitRules = ref<RateLimitRule[]>([])
const rateLimitStatistics = ref<RateLimitStatistics[]>([])
const routingRules = ref<ModelRoutingRule[]>([])
const routingStatus = ref<ModelRoutingStatus[]>([])

const rateLimitDialogVisible = ref(false)
const routingDialogVisible = ref(false)
const blacklistDialogVisible = ref(false)

const editingRateLimit = ref<RateLimitRule | null>(null)
const editingModelRoutingRule = ref<ModelRoutingRule | null>(null)

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

const routingForm = ref<ModelRoutingRuleForm>({
  modelId: '',
  qpsLimit: 10,
  maxConcurrent: 5
})

const blacklistForm = ref<BlacklistItem>({
  clientIp: '',
  reason: '',
  duration: 3600
})

const getLevelTagType = (level: string) => {
  const types: Record<string, any> = {
    global: 'danger',
    app: 'warning',
    interface: 'success',
    model: 'info'
  }
  return types[level] || ''
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
  return t(`rateLimit.dialog.targetPlaceholder.${rateLimitForm.value.level}`)
}

const loadRateLimitRules = async () => {
  rateLimitLoading.value = true
  try {
    const { data } = await rateLimitApi.getRules()
    rateLimitRules.value = data.data || []
  } catch (error) {
    ElMessage.error(t('rateLimit.message.loadRateLimitRulesFailed'))
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
    ElMessage.error(t('rateLimit.message.loadRateLimitStatisticsFailed'))
  } finally {
    statisticsLoading.value = false
  }
}

const loadModelRoutingRules = async () => {
  routingLoading.value = true
  try {
    const { data } = await circuitBreakerApi.getRules()
    routingRules.value = data.data || []
  } catch (error) {
    ElMessage.error(t('rateLimit.message.loadCircuitBreakerRulesFailed'))
  } finally {
    routingLoading.value = false
  }
}

const loadModelRoutingStatus = async () => {
  statusLoading.value = true
  try {
    const { data } = await circuitBreakerApi.getStatus()
    routingStatus.value = data.data || []
  } catch (error) {
    ElMessage.error(t('rateLimit.message.loadCircuitBreakerStatusFailed'))
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
    ElMessage.success(t('rateLimit.message.saveSuccess'))
    rateLimitDialogVisible.value = false
    loadRateLimitRules()
    loadRateLimitStatistics()
  } catch (error) {
    ElMessage.error(t('rateLimit.message.saveFailed'))
  } finally {
    saveLoading.value = false
  }
}

const handleInitDefaultRules = async () => {
  try {
    await ElMessageBox.confirm(
      t('rateLimit.message.initDefaultConfirm'), 
      t('rateLimit.message.initConfirmTitle'), 
      {
        confirmButtonText: t('rateLimit.message.confirmButton'),
        cancelButtonText: t('rateLimit.message.cancelButton'),
        type: 'warning'
      }
    )
    
    initLoading.value = true
    await rateLimitApi.initDefaultRules()
    ElMessage.success(t('rateLimit.message.initSuccess'))
    loadRateLimitRules()
    loadRateLimitStatistics()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('rateLimit.message.initFailed'))
    }
  } finally {
    initLoading.value = false
  }
}

const handleAddModelRoutingRule = () => {
  editingModelRoutingRule.value = null
  routingForm.value = {
    modelId: '',
    qpsLimit: 10,
    maxConcurrent: 5
  }
  routingDialogVisible.value = true
}

const handleEditModelRoutingRule = (row: ModelRoutingRule) => {
  editingModelRoutingRule.value = row
  routingForm.value = {
    modelId: row.modelId,
    qpsLimit: row.qpsLimit,
    maxConcurrent: row.maxConcurrent
  }
  routingDialogVisible.value = true
}

const handleSaveModelRoutingRule = async () => {
  saveLoading.value = true
  try {
    await circuitBreakerApi.upsertRule(routingForm.value)
    ElMessage.success(t('rateLimit.message.saveSuccess'))
    routingDialogVisible.value = false
    loadModelRoutingRules()
    loadModelRoutingStatus()
  } catch (error) {
    ElMessage.error(t('rateLimit.message.saveFailed'))
  } finally {
    saveLoading.value = false
  }
}

const handleDeleteModelRoutingRule = async (row: ModelRoutingRule) => {
  try {
    await ElMessageBox.confirm(
      t('rateLimit.message.deleteConfirm'), 
      t('rateLimit.message.initConfirmTitle'), 
      {
        confirmButtonText: t('rateLimit.message.confirmButton'),
        cancelButtonText: t('rateLimit.message.cancelButton'),
        type: 'warning'
      }
    )
    
    await circuitBreakerApi.deleteRule(row.id)
    ElMessage.success(t('rateLimit.message.deleteSuccess'))
    loadModelRoutingRules()
    loadModelRoutingStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('rateLimit.message.deleteFailed'))
    }
  }
}

const handleResetModelRoutingStatus = async (modelId: string) => {
  try {
    await circuitBreakerApi.resetStatus(modelId)
    ElMessage.success(t('rateLimit.message.resetSuccess'))
    loadModelRoutingStatus()
  } catch (error) {
    ElMessage.error(t('rateLimit.message.resetFailed'))
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
    ElMessage.success(t('rateLimit.message.addBlacklistSuccess'))
    blacklistDialogVisible.value = false
  } catch (error) {
    ElMessage.error(t('rateLimit.message.addBlacklistFailed'))
  } finally {
    saveLoading.value = false
  }
}

onMounted(() => {
  loadRateLimitRules()
  loadRateLimitStatistics()
  loadModelRoutingRules()
  loadModelRoutingStatus()
})
</script>

<style scoped>
.page-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.page-description {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.help-tip {
  background: #f4f4f5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.help-tip-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.help-tip ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.help-tip li {
  font-size: 13px;
  color: #909399;
  line-height: 1.8;
}

.config-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e4e7ed;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

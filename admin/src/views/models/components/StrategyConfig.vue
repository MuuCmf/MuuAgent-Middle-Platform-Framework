<template>
  <div class="help-tip">
    <div class="help-tip-title">💡 {{ $t('strategyConfig.helpTitle') }}</div>
    <ul>
      <li><strong>{{ $t('strategyConfig.helpItem1') }}</strong>
        <ul>
          <li><code>weight</code>：{{ $t('strategyConfig.helpWeight') }}</li>
          <li><code>random</code>：{{ $t('strategyConfig.helpRandom') }}</li>
          <li><code>round_robin</code>：{{ $t('strategyConfig.helpRoundRobin') }}</li>
          <li><code>failover</code>：{{ $t('strategyConfig.helpFailover') }}</li>
        </ul>
      </li>
      <li><strong>{{ $t('strategyConfig.helpItem2') }}</strong></li>
      <li><strong>{{ $t('strategyConfig.helpItem3') }}</strong></li>
      <li><strong>{{ $t('strategyConfig.helpItem4') }}</strong></li>
    </ul>
  </div>
  <div class="card">
    <div style="margin-bottom: 16px;">
      <el-button type="primary" @click="handleAddStrategy">
        <el-icon>
          <Plus />
        </el-icon>
        {{ $t('strategyConfig.createStrategy') }}
      </el-button>
    </div>

    <el-table :data="strategies" stripe v-loading="strategyLoading">
      <el-table-column prop="modelType" :label="$t('strategyConfig.modelType')">
        <template #default="{ row }">
          <el-tag>{{ row.modelType }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="strategy" :label="$t('strategyConfig.strategy')" width="120">
        <template #default="{ row }">
          <el-tag :type="getStrategyTagType(row.strategy)">
            {{ getStrategyLabel(row.strategy) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('strategyConfig.retryConfig')" width="180">
        <template #default="{ row }">
          <el-space direction="vertical" :size="4">
            <el-tag size="small">{{ $t('strategyConfig.retryCount') }}: {{ row.retryCount }}</el-tag>
            <el-tag size="small">{{ $t('strategyConfig.timeout') }}: {{ row.timeout }}ms</el-tag>
          </el-space>
        </template>
      </el-table-column>

      <el-table-column :label="$t('strategyConfig.circuitConfig')" width="220">
        <template #default="{ row }">
          <div v-if="row.enableCircuit">
            <el-space direction="vertical" :size="4">
              <el-tag size="small" type="success">{{ $t('strategyConfig.circuitEnabled') }}</el-tag>
              <el-tag size="small">{{ $t('strategyConfig.circuitThreshold') }}: {{ row.circuitThreshold }}</el-tag>
              <el-tag size="small">{{ $t('strategyConfig.circuitTimeout') }}: {{ row.circuitTimeout }}ms</el-tag>
            </el-space>
          </div>
          <el-tag v-else size="small" type="info">{{ $t('strategyConfig.circuitDisabled') }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="fallbackModelId" :label="$t('strategyConfig.fallbackModelId')" width="150">
        <template #default="{ row }">
          <el-tag v-if="row.fallbackModelId" type="warning">{{ row.fallbackModelId }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="180" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditStrategy(row)">{{ $t('strategyConfig.edit') }}</el-button>
          <el-button size="small" type="danger" @click="handleDeleteStrategy(row.modelType)">{{ $t('strategyConfig.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingStrategy ? $t('strategyConfig.editStrategy') : $t('strategyConfig.createStrategyTitle')" width="700px" @close="resetForm">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="140px">
      <el-form-item :label="$t('strategyConfig.modelType')" prop="modelType">
        <el-input v-model="form.modelType" :placeholder="$t('strategyConfig.modelTypePlaceholder')" :disabled="!!editingStrategy" />
      </el-form-item>

      <el-form-item :label="$t('strategyConfig.strategy')" prop="strategy">
        <el-select v-model="form.strategy" :placeholder="$t('strategyConfig.strategyPlaceholder')" style="width: 100%">
          <el-option :label="$t('strategyLabel.weight')" value="weight" />
          <el-option :label="$t('strategyLabel.random')" value="random" />
          <el-option :label="$t('strategyLabel.roundRobin')" value="round_robin" />
          <el-option :label="$t('strategyLabel.failover')" value="failover" />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">{{ $t('strategyConfig.retryConfig') }}</el-divider>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('strategyConfig.retryCount')" prop="retryCount">
            <el-input-number v-model="form.retryCount" :min="0" :max="10" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('strategyConfig.timeout')" prop="timeout">
            <el-input-number v-model="form.timeout" :min="1000" :max="300000" :step="1000" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">{{ $t('strategyConfig.circuitConfig') }}</el-divider>

      <el-form-item :label="$t('strategyConfig.enableCircuit')">
        <el-switch v-model="form.enableCircuit" />
        <el-text size="small" type="info" style="margin-left: 10px">
          {{ $t('strategyConfig.circuitTip') }}
        </el-text>
      </el-form-item>

      <template v-if="form.enableCircuit">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('strategyConfig.circuitThreshold')" prop="circuitThreshold">
              <el-input-number v-model="form.circuitThreshold" :min="1" :max="100" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('strategyConfig.circuitTimeout')" prop="circuitTimeout">
              <el-input-number v-model="form.circuitTimeout" :min="10000" :max="600000" :step="10000" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <el-divider content-position="left">{{ $t('strategyConfig.degradeConfig') }}</el-divider>

      <el-form-item :label="$t('strategyConfig.fallbackModelId')">
        <el-input v-model="form.fallbackModelId" :placeholder="$t('strategyConfig.fallbackPlaceholder')" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ $t('strategyConfig.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        {{ $t('strategyConfig.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { routingApi, type ModelRoutingStrategy, type ModelRoutingStrategyForm } from "@/api/model-routing"

const { t } = useI18n()

const strategyLoading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const strategies = ref<ModelRoutingStrategy[]>([])
const editingStrategy = ref<ModelRoutingStrategy | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<ModelRoutingStrategyForm>({
  modelType: '',
  strategy: 'weight',
  retryCount: 3,
  timeout: 30000,
  fallbackModelId: '',
  enableCircuit: true,
  circuitThreshold: 5,
  circuitTimeout: 300000
})

const rules: FormRules = {
  modelType: [
    { required: true, message: t('strategyConfig.requiredModelType'), trigger: 'blur' }
  ],
  strategy: [
    { required: true, message: t('strategyConfig.requiredStrategy'), trigger: 'change' }
  ],
  retryCount: [
    { required: true, message: t('strategyConfig.requiredRetryCount'), trigger: 'blur' }
  ],
  timeout: [
    { required: true, message: t('strategyConfig.requiredTimeout'), trigger: 'blur' }
  ]
}

const getStrategyLabel = (strategy: string) => {
  const map: Record<string, string> = {
    weight: t('strategyLabel.weight'),
    random: t('strategyLabel.random'),
    round_robin: t('strategyLabel.roundRobin'),
    failover: t('strategyLabel.failover')
  }
  return map[strategy] || strategy
}

const getStrategyTagType = (strategy: string) => {
  const map: Record<string, any> = {
    weight: 'primary',
    random: 'success',
    round_robin: 'warning',
    failover: 'danger'
  }
  return map[strategy] || 'primary'
}

const loadStrategies = async () => {
  strategyLoading.value = true
  try {
    const { data } = await routingApi.getStrategies()
    strategies.value = data.data || []
  } catch {
    ElMessage.error(t('strategyConfig.loadFailed'))
  } finally {
    strategyLoading.value = false
  }
}

const handleAddStrategy = () => {
  editingStrategy.value = null
  resetForm()
  dialogVisible.value = true
}

const handleEditStrategy = (row: ModelRoutingStrategy) => {
  editingStrategy.value = row
  Object.assign(form, {
    modelType: row.modelType,
    strategy: row.strategy,
    retryCount: row.retryCount,
    timeout: row.timeout,
    fallbackModelId: row.fallbackModelId || '',
    enableCircuit: row.enableCircuit,
    circuitThreshold: row.circuitThreshold,
    circuitTimeout: row.circuitTimeout
  })
  dialogVisible.value = true
}

const handleDeleteStrategy = async (_modelType: string) => {
  try {
    await ElMessageBox.confirm(
      t('strategyConfig.deleteConfirm'),
      t('strategyConfig.deleteTitle'),
      { type: 'warning' }
    )
    ElMessage.success(t('strategyConfig.deleteSuccess'))
    loadStrategies()
  } catch {
    // cancelled
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (editingStrategy.value) {
        await routingApi.updateStrategy(editingStrategy.value.modelType, form)
        ElMessage.success(t('strategyConfig.updateSuccess'))
      } else {
        await routingApi.createStrategy(form)
        ElMessage.success(t('strategyConfig.createSuccess'))
      }
      dialogVisible.value = false
      loadStrategies()
    } catch {
      ElMessage.error(t('strategyConfig.operationFailed'))
    } finally {
      submitting.value = false
    }
  })
}

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(form, {
    modelType: '',
    strategy: 'weight',
    retryCount: 3,
    timeout: 30000,
    fallbackModelId: '',
    enableCircuit: true,
    circuitThreshold: 5,
    circuitTimeout: 300000
  })
}

onMounted(() => {
  loadStrategies()
})
</script>

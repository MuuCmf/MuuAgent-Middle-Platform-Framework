<template>
  <div class="help-tip">
    <div class="help-tip-title">💡 {{ $t('modelStatus.helpTitle') }}</div>
    <ul>
      <li><strong>{{ $t('modelStatus.helpItem1') }}</strong></li>
      <li><strong>{{ $t('modelStatus.helpItem2') }}</strong></li>
      <li><strong>{{ $t('modelStatus.helpItem3') }}</strong></li>
      <li><strong>{{ $t('modelStatus.helpItem4') }}</strong>
        <ul>
          <li><code>closed</code>：{{ $t('modelStatus.helpCircuitClosed') }}</li>
          <li><code>open</code>：{{ $t('modelStatus.helpCircuitOpen') }}</li>
          <li><code>half_open</code>：{{ $t('modelStatus.helpCircuitHalfOpen') }}</li>
        </ul>
      </li>
    </ul>
  </div>
  <div class="card">
    <div class="card-title">
      {{ $t('modelStatus.title') }}
    </div>
    <el-table :data="modelStatus" stripe v-loading="statusLoading">
      <el-table-column :label="$t('modelStatus.model')">
        <template #default="{ row }">
          <strong>{{ row.modelName }}</strong>
          <br>
          <small style="color: #999">{{ row.modelCode }}</small>
        </template>
      </el-table-column>
      <el-table-column prop="circuitStatus" :label="$t('modelStatus.circuitStatus')" width="120">
        <template #default="{ row }">
          <el-tag :type="getCircuitTagType(row.circuitStatus)">
            {{ getCircuitStatusText(row.circuitStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="errorCount" :label="$t('modelStatus.errorCount')" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.errorCount > 0" type="danger">{{ row.errorCount }}</el-tag>
          <span v-else>{{ row.errorCount }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('modelStatus.currentConcurrent')" width="120">
        <template #default="{ row }">
          {{ row.currentConcurrent }} / {{ row.maxConcurrent }}
        </template>
      </el-table-column>
      <el-table-column prop="maxConcurrent" :label="$t('modelStatus.maxConcurrent')" width="100" />
      <el-table-column prop="qpsLimit" :label="$t('modelStatus.qpsLimit')" width="100" />
      <el-table-column :label="$t('common.actions')" width="120" align="right">
        <template #default="{ row }">
          <el-button v-if="row.circuitStatus !== 'closed'" size="small" type="primary" @click="handleResetCircuit(row.modelId)">
            {{ $t('modelStatus.resetCircuit') }}
          </el-button>
          <el-button v-else size="small" type="primary" disabled>
            {{ $t('modelStatus.resetCircuit') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { routingApi } from "@/api/model-routing"

const { t } = useI18n()

const statusLoading = ref(false)
const modelStatus = ref<any[]>([])

const getCircuitTagType = (status: string) => {
  const map: Record<string, any> = {
    'closed': 'success',
    'open': 'danger',
    'half_open': 'warning'
  }
  return map[status] || 'info'
}

const getCircuitStatusText = (status: string) => {
  const map: Record<string, string> = {
    'closed': t('circuitStatus.closed'),
    'open': t('circuitStatus.open'),
    'half_open': t('circuitStatus.halfOpen')
  }
  return map[status] || status
}

const loadModelStatus = async () => {
  statusLoading.value = true
  try {
    const { data } = await routingApi.getStatus()
    modelStatus.value = data.data || []
  } catch {
    ElMessage.error(t('modelStatus.loadFailed'))
  } finally {
    statusLoading.value = false
  }
}

const handleResetCircuit = async (modelId: string) => {
  try {
    await routingApi.resetCircuit(modelId)
    ElMessage.success(t('modelStatus.resetSuccess'))
    loadModelStatus()
  } catch {
    ElMessage.error(t('modelStatus.resetFailed'))
  }
}

onMounted(() => {
  loadModelStatus()
})
</script>

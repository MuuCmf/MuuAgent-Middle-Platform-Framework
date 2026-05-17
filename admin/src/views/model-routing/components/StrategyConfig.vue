<template>
  <div class="help-tip">
    <div class="help-tip-title">💡 策略配置说明</div>
    <ul>
      <li><strong>调度策略</strong>：
        <ul>
          <li><code>weight</code>：权重调度，根据模型权重分配请求</li>
          <li><code>random</code>：随机调度，随机选择可用模型</li>
          <li><code>round_robin</code>：轮询调度，依次调用各个模型</li>
          <li><code>failover</code>：故障转移，主模型不可用时切换到备用模型</li>
        </ul>
      </li>
      <li><strong>重试机制</strong>：请求失败后自动重试，提高成功率</li>
      <li><strong>熔断保护</strong>：错误次数达到阈值时自动熔断，保护系统稳定性</li>
      <li><strong>降级模型</strong>：主模型不可用时自动切换到降级模型</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-title">
      策略配置
    </div>
    <div style="margin-bottom: 16px;">
      <el-button type="primary" @click="handleAddStrategy">
        <el-icon>
          <Plus />
        </el-icon>
        新建策略
      </el-button>
    </div>

    <el-table :data="strategies" stripe v-loading="strategyLoading">
      <el-table-column prop="modelType" label="模型类型">
        <template #default="{ row }">
          <el-tag>{{ row.modelType }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="strategy" label="调度策略" width="120">
        <template #default="{ row }">
          <el-tag :type="getStrategyType(row.strategy)">
            {{ getStrategyLabel(row.strategy) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="重试配置" width="180">
        <template #default="{ row }">
          <el-space direction="vertical" :size="4">
            <el-tag size="small">重试次数: {{ row.retryCount }}</el-tag>
            <el-tag size="small">超时: {{ row.timeout }}ms</el-tag>
          </el-space>
        </template>
      </el-table-column>

      <el-table-column label="熔断配置" width="220">
        <template #default="{ row }">
          <div v-if="row.enableCircuit">
            <el-space direction="vertical" :size="4">
              <el-tag size="small" type="success">熔断已启用</el-tag>
              <el-tag size="small">错误阈值: {{ row.circuitThreshold }}</el-tag>
              <el-tag size="small">恢复时间: {{ row.circuitTimeout }}ms</el-tag>
            </el-space>
          </div>
          <el-tag v-else size="small" type="info">熔断未启用</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="fallbackModelId" label="降级模型" width="150">
        <template #default="{ row }">
          <el-tag v-if="row.fallbackModelId" type="warning">{{ row.fallbackModelId }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="180" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditStrategy(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDeleteStrategy(row.modelType)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingStrategy ? '编辑策略' : '新建策略'" width="700px" @close="resetForm">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="140px">
      <el-form-item label="模型类型" prop="modelType">
        <el-input v-model="form.modelType" placeholder="请输入模型类型，如：gpt-4, claude-3" :disabled="!!editingStrategy" />
      </el-form-item>

      <el-form-item label="调度策略" prop="strategy">
        <el-select v-model="form.strategy" placeholder="请选择调度策略" style="width: 100%">
          <el-option label="权重调度" value="weight" />
          <el-option label="随机调度" value="random" />
          <el-option label="轮询调度" value="round_robin" />
          <el-option label="故障转移" value="failover" />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">重试配置</el-divider>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="重试次数" prop="retryCount">
            <el-input-number v-model="form.retryCount" :min="0" :max="10" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="超时时间(ms)" prop="timeout">
            <el-input-number v-model="form.timeout" :min="1000" :max="300000" :step="1000" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">熔断配置</el-divider>

      <el-form-item label="启用熔断">
        <el-switch v-model="form.enableCircuit" />
        <el-text size="small" type="info" style="margin-left: 10px">
          当错误次数达到阈值时自动熔断
        </el-text>
      </el-form-item>

      <template v-if="form.enableCircuit">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="错误阈值" prop="circuitThreshold">
              <el-input-number v-model="form.circuitThreshold" :min="1" :max="100" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="恢复时间(ms)" prop="circuitTimeout">
              <el-input-number v-model="form.circuitTimeout" :min="10000" :max="600000" :step="10000"
                style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <el-divider content-position="left">降级配置</el-divider>

      <el-form-item label="降级模型ID">
        <el-input v-model="form.fallbackModelId" placeholder="可选：当主模型不可用时切换到此模型" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { routingApi, type ModelRoutingStrategy, type ModelRoutingStrategyForm } from "@/api/model-routing"

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
    { required: true, message: '请输入模型类型', trigger: 'blur' }
  ],
  strategy: [
    { required: true, message: '请选择调度策略', trigger: 'change' }
  ],
  retryCount: [
    { required: true, message: '请输入重试次数', trigger: 'blur' }
  ],
  timeout: [
    { required: true, message: '请输入超时时间', trigger: 'blur' }
  ]
}

const getStrategyLabel = (strategy: string) => {
  const map: Record<string, string> = {
    weight: '权重',
    random: '随机',
    round_robin: '轮询',
    failover: '故障转移'
  }
  return map[strategy] || strategy
}

const getStrategyType = (strategy: string) => {
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
  } catch (error) {
    console.error('加载策略列表失败', error)
    ElMessage.error('加载策略列表失败')
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
    await ElMessageBox.confirm('确定要删除该策略吗？', '提示', {
      type: 'warning'
    })
    ElMessage.success('删除成功')
    loadStrategies()
  } catch (error) {
    console.error('删除失败', error)
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
        ElMessage.success('更新成功')
      } else {
        await routingApi.createStrategy(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadStrategies()
    } catch (error) {
      console.error('提交失败', error)
      ElMessage.error('操作失败')
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
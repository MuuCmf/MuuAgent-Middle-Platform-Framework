<template>
  <div class="model-selector">
    <el-select
      v-model="localType"
      placeholder="选择类型"
      @change="handleTypeChange"
      style="width: 100%; margin-bottom: 8px"
    >
      <el-option label="模型对话" value="model">
        <div class="model-option">
          <el-icon><Cpu /></el-icon>
          <span>模型对话</span>
        </div>
      </el-option>
      <el-option label="智能体对话" value="agent">
        <div class="model-option">
          <el-icon><Avatar /></el-icon>
          <span>智能体对话</span>
        </div>
      </el-option>
    </el-select>

    <el-select
      v-model="localModel"
      :placeholder="localType === 'model' ? '选择模型' : '选择智能体'"
      @change="handleModelChange"
      style="width: 100%"
    >
      <template v-if="localType === 'model'">
        <el-option label="MCP调度 (自动选择)" value="mcp">
          <div class="model-option">
            <el-icon><MagicStick /></el-icon>
            <span>MCP调度 (自动选择)</span>
          </div>
        </el-option>
        <el-option
          v-for="model in enabledModels"
          :key="model.id"
          :label="model.name"
          :value="model.code"
        >
          <div class="model-option">
            <el-icon><Cpu /></el-icon>
            <span>{{ model.name }}</span>
          </div>
        </el-option>
      </template>

      <template v-else>
        <el-option
          v-for="agent in enabledAgents"
          :key="agent.id"
          :label="agent.name"
          :value="agent.id"
        >
          <div class="model-option">
            <el-icon><Avatar /></el-icon>
            <span>{{ agent.name }}</span>
            <span v-if="agent.description" class="agent-desc">{{ agent.description }}</span>
          </div>
        </el-option>
      </template>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { MagicStick, Cpu, Avatar } from '@element-plus/icons-vue'

interface Props {
  type: 'model' | 'agent'
  model: string
  models: any[]
  agents: any[]
}

const props = withDefaults(defineProps<Props>(), {
  type: 'model',
  models: () => [],
  agents: () => [],
})

const emit = defineEmits<{
  'update:type': [value: 'model' | 'agent']
  'update:model': [value: string]
  change: [{ type: 'model' | 'agent'; value: string }]
}>()

const localType = ref<'model' | 'agent'>(props.type)
const localModel = ref(props.model)

watch(() => props.type, (newVal) => {
  localType.value = newVal
})

watch(() => props.model, (newVal) => {
  localModel.value = newVal
})

const enabledModels = computed(() => {
  return props.models.filter(m => m.status === true)
})

const enabledAgents = computed(() => {
  return props.agents.filter(a => a.status === true)
})

const handleTypeChange = (value: 'model' | 'agent') => {
  localModel.value = value === 'model' ? 'mcp' : ''
  emit('update:type', value)
  emit('update:model', localModel.value)
  emit('change', { type: value, value: localModel.value })
}

const handleModelChange = (value: string) => {
  emit('update:model', value)
  emit('change', { type: localType.value, value })
}
</script>

<script lang="ts">
export default {
  name: 'ModelSelector'
}
</script>

<style scoped>
.model-selector {
  padding: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-desc {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

:deep(.el-select__wrapper) {
  border-radius: 8px;
}
</style>

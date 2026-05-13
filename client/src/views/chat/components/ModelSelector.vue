<template>
  <div class="model-selector-container">
    <div class="selector-header">
      <span class="selector-title">模型选择</span>
      <span v-if="selectedModelInfo" class="model-tag">
        {{ selectedModelInfo.type === 'mcp' ? '自动调度' : '指定模型' }}
      </span>
    </div>
    
    <div class="selector-body">
      <!-- MCP调度选项 -->
      <div
        :class="['model-card', { active: modelCode === 'mcp' || !modelCode }]"
        @click="selectModel('mcp')"
      >
        <div class="model-icon mcp-icon">
          <el-icon :size="24"><Star /></el-icon>
        </div>
        <div class="model-info">
          <div class="model-name">MCP智能调度</div>
          <div class="model-desc">自动选择最优模型，支持负载均衡和故障转移</div>
        </div>
        <div class="model-check">
          <el-icon v-if="modelCode === 'mcp' || !modelCode"><Check /></el-icon>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="divider">
        <span>指定模型</span>
      </div>

      <!-- 可用模型列表 -->
      <div
        v-for="model in enabledModels"
        :key="model.id"
        :class="['model-card', { active: modelCode === model.code }]"
        @click="selectModel(model.code)"
      >
        <div class="model-icon">
          <el-icon :size="24"><Cpu /></el-icon>
        </div>
        <div class="model-info">
          <div class="model-name">{{ model.name }}</div>
          <div class="model-desc">{{ model.description || 'LLM模型' }}</div>
        </div>
        <div class="model-check">
          <el-icon v-if="modelCode === model.code"><Check /></el-icon>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="enabledModels.length === 0" class="empty-state">
        <el-icon :size="48" color="#ddd"><Cpu /></el-icon>
        <div>暂无可用模型</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Star, Cpu } from '@element-plus/icons-vue'

interface Props {
  modelCode: string
  models: any[]
}

const props = withDefaults(defineProps<Props>(), {
  modelCode: '',
  models: () => [],
})

const emit = defineEmits<{
  'update:modelCode': [value: string]
  change: [value: string]
}>()

const enabledModels = computed(() => {
  return props.models.filter(m => m.status === true && m.type === 'llm')
})

const selectedModelInfo = computed(() => {
  if (props.modelCode === 'mcp' || !props.modelCode) {
    return { type: 'mcp', name: 'MCP智能调度' }
  }
  const model = enabledModels.value.find(m => m.code === props.modelCode)
  return model ? { type: 'specified', name: model.name } : null
})

const selectModel = (code: string) => {
  emit('update:modelCode', code)
  emit('change', code)
}
</script>

<style scoped>
.model-selector-container {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.selector-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.model-tag {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  color: #fff;
}

.selector-body {
  padding: 8px;
}

.model-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.model-card:hover {
  background: #f8f9fa;
}

.model-card.active {
  background: #f0f5ff;
  border-color: #667eea;
}

.model-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f5ff 0%, #e8ecf5 100%);
  color: #667eea;
}

.model-icon.mcp-icon {
  background: linear-gradient(135deg, #fff3e6 0%, #ffe8cc 100%);
  color: #f59e0b;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.model-desc {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  transition: all 0.2s ease;
}

.model-card.active .model-check {
  background: #667eea;
}

.divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 4px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}

.divider span {
  font-size: 12px;
  color: #999;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: #999;
}

.empty-state div {
  margin-top: 8px;
  font-size: 14px;
}
</style>
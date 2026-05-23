<template>
  <div class="model-selector-container">
    <div
      :class="['model-card', { active: modelCode === 'mcp-llm' || !modelCode }]"
      @click="selectModel('mcp-llm')"
    >
      <div class="model-icon mcp-icon">
        <el-icon :size="22"><Star /></el-icon>
      </div>
      <div class="model-info">
        <div class="model-name">Auto 智能调度</div>
        <div class="model-desc">自动选择最优模型，支持负载均衡和故障转移</div>
      </div>
      <div class="model-check">
        <el-icon v-if="modelCode === 'mcp-llm' || !modelCode"><Check /></el-icon>
      </div>
    </div>

    <div class="divider">
      <span>指定模型</span>
    </div>

    <div
      v-for="model in enabledModels"
      :key="model.id"
      :class="['model-card', { active: modelCode === model.code }]"
      @click="selectModel(model.code)"
    >
      <div class="model-icon">
        <el-icon :size="22"><Cpu /></el-icon>
      </div>
      <div class="model-info">
        <div class="model-name">{{ model.name }}</div>
        <div class="model-desc">{{ model.description || 'LLM模型' }}</div>
      </div>
      <div class="model-check">
        <el-icon v-if="modelCode === model.code"><Check /></el-icon>
      </div>
    </div>

    <div v-if="enabledModels.length === 0" class="empty-state">
      <el-icon :size="40" color="var(--text-tertiary)"><Cpu /></el-icon>
      <div>暂无可用模型</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Star, Cpu } from '@element-plus/icons-vue'

interface Props {
  /** 当前选中的模型编码 */
  modelCode: string
  /** 模型列表 */
  models: any[]
}

const props = withDefaults(defineProps<Props>(), {
  modelCode: '',
  models: () => [],
})

const emit = defineEmits<{
  /** 模型编码更新 */
  'update:modelCode': [value: string]
  /** 模型变更 */
  change: [value: string]
}>()

/**
 * 已启用的模型列表
 */
const enabledModels = computed(() => {
  return props.models.filter(m => m.status === true && m.type === 'llm')
})

/**
 * 选择模型
 * @param code 模型编码
 */
const selectModel = (code: string) => {
  emit('update:modelCode', code)
  emit('change', code)
}
</script>

<style lang="scss" scoped>
.model-selector-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.active {
    background: var(--bg-color);
    border-color: var(--primary-color);

    .model-check {
      background: var(--primary-color);
    }
  }
}

.model-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--primary-color);
  flex-shrink: 0;

  &.mcp-icon {
    background: linear-gradient(135deg, #fff3e6 0%, #ffe8cc 100%);
    color: #f59e0b;
  }
}

html.dark .model-icon.mcp-icon {
  background: linear-gradient(135deg, #3d2e0a 0%, #4a3510 100%);
  color: #fbbf24;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 2px;
}

.model-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  font-size: 12px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }

  span {
    font-size: 11px;
    color: var(--text-tertiary);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-tertiary);

  div {
    margin-top: 8px;
    font-size: 13px;
  }
}
</style>

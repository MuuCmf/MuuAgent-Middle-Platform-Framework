<template>
  <div class="reasoning-step-card" :class="step.stepType">
    <div class="step-header">
      <el-tag size="small" :type="getTagType()">
        {{ getStepLabel() }}
      </el-tag>
      <span class="step-number">Step {{ step.stepNumber }}</span>
      <el-tag v-if="step.costMs" size="small" type="info">
        {{ step.costMs }}ms
      </el-tag>
    </div>

    <div class="step-content">
      <div v-if="step.thought" class="thought">
        <el-icon><Cpu /></el-icon>
        <span>{{ step.thought }}</span>
      </div>

      <div v-if="step.action" class="action">
        <div class="action-name">
          <el-icon><Connection /></el-icon>
          <span>调用工具: {{ step.action }}</span>
        </div>
        <div v-if="step.actionInput" class="action-input">
          <pre>{{ formatJson(step.actionInput) }}</pre>
        </div>
      </div>

      <div v-if="step.observation" class="observation">
        <el-icon><View /></el-icon>
        <pre>{{ step.observation }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Cpu, Connection, View } from '@element-plus/icons-vue'
import type { ReasoningStep } from '@/api/agent'

interface Props {
  step: ReasoningStep
}

const props = defineProps<Props>()

const getStepLabel = () => {
  const labels: Record<string, string> = {
    thought: '思考',
    action: '行动',
    observation: '观察',
    final_answer: '最终答案',
  }
  return labels[props.step.stepType] || props.step.stepType
}

const getTagType = () => {
  const types: Record<string, string> = {
    thought: '',
    action: 'success',
    observation: 'warning',
    final_answer: 'danger',
  }
  return types[props.step.stepType] || 'info'
}

const formatJson = (data: any) => {
  try {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
</script>

<style lang="scss" scoped>
.reasoning-step-card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  background: #fafafa;

  &.thought {
    border-left: 3px solid #409eff;
    background: #ecf5ff;
  }

  &.action {
    border-left: 3px solid #67c23a;
    background: #f0f9eb;
  }

  &.observation {
    border-left: 3px solid #e6a23c;
    background: #fdf6ec;
  }

  &.final_answer {
    border-left: 3px solid #f56c6c;
    background: #fef0f0;
  }
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-number {
  color: #909399;
  font-size: 12px;
}

.step-content {
  font-size: 13px;
  line-height: 1.6;
}

.thought, .action, .observation {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 6px;

  .el-icon {
    margin-top: 3px;
    flex-shrink: 0;
  }
}

.action-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: #67c23a;
}

.action-input, .observation {
  pre {
    margin: 4px 0;
    padding: 8px;
    background: #fff;
    border-radius: 4px;
    font-size: 12px;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>

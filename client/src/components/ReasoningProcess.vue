<template>
  <div class="reasoning-container">
    <div class="reasoning-header" @click="toggleExpand">
      <div class="reasoning-title-row">
        <span class="reasoning-brain-icon">🧠</span>
        <span class="reasoning-title">推理过程</span>
        <span class="step-count">{{ filteredSteps.length }} 步</span>
      </div>
      <span class="expand-icon" :class="{ expanded: isExpanded }">▼</span>
    </div>

    <div v-if="isExpanded" class="reasoning-content">
      <div v-for="(step, sIdx) in filteredSteps" :key="sIdx" class="step-item">
        <div class="step-header">
          <span class="step-number">{{ sIdx + 1 }}</span>
          <span class="step-type" :class="'type-' + step.stepType">
            <template v-if="step.stepType === 'thought'">💭 思考</template>
            <template v-else-if="step.stepType === 'action'">⚡ {{ step.toolName || '工具调用' }}</template>
            <template v-else>📊 执行结果</template>
          </span>
        </div>
        
        <div class="step-body">
          <template v-if="step.stepType === 'thought'">
            <p>{{ formatThoughtContent(step.content) }}</p>
          </template>
          <template v-else-if="step.stepType === 'action'">
            <div v-if="step.actionInput || step.toolArgs" class="code-block">
              <code>{{ formatArgs(step.actionInput || step.toolArgs) }}</code>
            </div>
          </template>
          <template v-else>
            <div class="code-block">
              <pre>{{ formatObservation(step.content || step.toolOutput) }}</pre>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ReasoningStep } from '../api/reasoning'

const props = defineProps<{
  steps?: ReasoningStep[]
  finalAnswer?: string
}>()

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const formatThoughtContent = (content?: string) => {
  if (!content) return ''
  return content
    .replace(/^(Thought|Thought:)\s*/i, '')
    .replace(/^[:：]\s*/, '')
    .trim()
}

const formatArgs = (args: any) => {
  if (!args) return ''
  return typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)
}

const formatObservation = (observation: any) => {
  if (!observation) return ''
  return typeof observation === 'object' ? JSON.stringify(observation, null, 2) : String(observation)
}

const filteredSteps = computed(() => {
  if (!props.steps || props.steps.length === 0) return []
  return props.steps.filter(step => step.stepType !== 'final_answer')
})
</script>

<style scoped>
.reasoning-container {
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}

.reasoning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.reasoning-header:hover {
  background: #f1f5f9;
}

.reasoning-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reasoning-brain-icon {
  font-size: 18px;
}

.reasoning-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.step-count {
  font-size: 12px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
}

.expand-icon {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.reasoning-content {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  max-height: 400px;
  overflow-y: auto;
}

.step-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.step-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #6366f1;
  color: white;
  font-size: 11px;
  font-weight: 600;
}

.step-type {
  font-size: 13px;
  font-weight: 500;
}

.step-type.type-thought {
  color: #8b5cf6;
}

.step-type.type-action {
  color: #f59e0b;
}

.step-type.type-observation {
  color: #10b981;
}

.step-body p {
  font-size: 13px;
  line-height: 1.6;
  color: #4b5563;
  margin: 0;
}

.code-block {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
  overflow-x: auto;
}

.code-block code,
.code-block pre {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #374151;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

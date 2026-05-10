<template>
  <div class="reasoning-container">
    <div class="reasoning-header">
      <div class="reasoning-title-row">
        <span class="reasoning-brain-icon">🧠</span>
        <span class="reasoning-title">思维链</span>
        <span class="reasoning-subtitle">Reasoning Process</span>
      </div>
      <div class="reasoning-steps-badge">
        <span class="step-count">{{ filteredSteps.length }}</span>
        <span class="step-text">步</span>
      </div>
    </div>

    <div class="reasoning-flow">
      <div class="flow-item" v-for="(step, sIdx) in filteredSteps" :key="sIdx">
        <span class="flow-dot" :class="'flow-' + step.stepType"></span>
        <span class="flow-label">{{ getStepLabel(step) }}</span>
      </div>
    </div>

    <div class="reasoning-cards">
      <div v-for="(step, sIdx) in filteredSteps" :key="sIdx" class="step-card-wrapper">
        <div class="step-number" :class="'number-' + step.stepType">
          <span>{{ sIdx + 1 }}</span>
        </div>

        <div class="step-card" :class="'card-' + step.stepType">
          <div class="step-card-header">
            <div class="step-type-badge" :class="'badge-' + step.stepType">
              <span class="step-type-icon">
                <template v-if="step.stepType === 'thought'">💭</template>
                <template v-else-if="step.stepType === 'action'">⚡</template>
                <template v-else>📊</template>
              </span>
              <span class="step-type-text">
                <template v-if="step.stepType === 'thought'">思考</template>
                <template v-else-if="step.stepType === 'action'">工具调用</template>
                <template v-else>执行结果</template>
              </span>
            </div>
            <div class="step-card-actions">
              <span class="step-time">步骤 {{ sIdx + 1 }}</span>
            </div>
          </div>

          <div class="step-card-body">
            <template v-if="step.stepType === 'thought'">
              <div class="thought-content">
                <p>{{ formatThoughtContent(step.content) }}</p>
              </div>
            </template>
            <template v-else-if="step.stepType === 'action'">
              <div class="action-content">
                <div class="action-tool-header">
                  <span class="tool-icon">🔧</span>
                  <span class="tool-name">{{ step.toolName || step.action }}</span>
                </div>
                <div v-if="step.actionInput || step.toolArgs" class="action-args">
                  <span class="args-label">调用参数</span>
                  <div class="args-content">
                    <code>{{ formatArgs(step.actionInput || step.toolArgs) }}</code>
                  </div>
                </div>
                <div v-if="step.content" class="action-thought">
                  <span class="thought-label">思考依据</span>
                  <p>{{ formatThoughtContent(step.content) }}</p>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="observation-content">
                <div class="observation-header">
                  <span class="result-icon">✅</span>
                  <span class="result-label">工具 <strong>{{ step.toolName }}</strong> 返回结果</span>
                </div>
                <div class="observation-data">
                  <pre>{{ formatObservation(step.content || step.toolOutput) }}</pre>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReasoningStep } from '../api/reasoning'

const props = defineProps<{
  steps?: ReasoningStep[]
  finalAnswer?: string
}>()

const formatThoughtContent = (content?: string) => {
  if (!content) return ''
  let cleaned = content
    .replace(/^(Thought|Thought:)\s*/i, '')
    .replace(/^[:：]\s*/, '')
    .trim()

  cleaned = cleaned.split('\n').filter(line => {
    const trimmedLine = line.trim()
    return !trimmedLine.startsWith('Action:') &&
           !trimmedLine.startsWith('Action Input:') &&
           !trimmedLine.startsWith('Observation:') &&
           !trimmedLine.startsWith('Thought:')
  }).join('\n').trim()

  return cleaned || content.trim()
}

const formatArgs = (args: any) => {
  if (!args) return ''
  if (typeof args === 'object') {
    return JSON.stringify(args, null, 2)
  }
  return String(args)
}

const formatObservation = (observation: any) => {
  if (!observation) return ''
  if (typeof observation === 'object') {
    return JSON.stringify(observation, null, 2)
  }
  return String(observation)
}

const getStepLabel = (step: ReasoningStep) => {
  if (step.stepType === 'thought') return '思考'
  if (step.stepType === 'action') return step.toolName || '工具调用'
  if (step.stepType === 'observation') return '结果'
  return '步骤'
}

const filteredSteps = computed(() => {
  if (!props.steps || props.steps.length === 0) return []

  const filteredSteps: ReasoningStep[] = []

  for (const step of props.steps) {
    if (step.stepType === 'final_answer') continue

    if (props.finalAnswer && step.stepType === 'thought' && step.content) {
      const thoughtContent = formatThoughtContent(step.content)
      if (props.finalAnswer.startsWith(thoughtContent) && thoughtContent.length > 5) {
        continue
      }
    }

    filteredSteps.push(step)
  }

  return filteredSteps
})
</script>

<style scoped>
.reasoning-container {
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.reasoning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  color: white;
}

.reasoning-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reasoning-brain-icon {
  font-size: 22px;
}

.reasoning-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.reasoning-subtitle {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 400;
  margin-left: 4px;
}

.reasoning-steps-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.step-count {
  font-weight: 700;
  font-size: 15px;
}

.step-text {
  opacity: 0.9;
}

.reasoning-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  white-space: nowrap;
}

.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.flow-dot.flow-thought {
  background: #8b5cf6;
}

.flow-dot.flow-action {
  background: #f59e0b;
}

.flow-dot.flow-observation {
  background: #10b981;
}

.flow-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.reasoning-cards {
  padding: 16px 20px;
}

.step-card-wrapper {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.step-card-wrapper:last-child {
  margin-bottom: 0;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-number.number-thought {
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
  color: #7c3aed;
}

.step-number.number-action {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
}

.step-number.number-observation {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #059669;
}

.step-card {
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.step-card.card-thought {
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border: 1px solid #e9d5ff;
}

.step-card.card-action {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fcd34d;
}

.step-card.card-observation {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
}

.step-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.step-type-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
}

.step-type-badge.badge-thought {
  background: rgba(124, 58, 237, 0.1);
}

.step-type-badge.badge-action {
  background: rgba(217, 119, 6, 0.1);
}

.step-type-badge.badge-observation {
  background: rgba(5, 150, 105, 0.1);
}

.step-type-icon {
  font-size: 14px;
}

.step-type-text {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.step-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-time {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.step-card-body {
  padding: 14px 16px;
}

.thought-content p {
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  font-style: italic;
  margin: 0;
}

.action-content .action-tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.action-content .tool-icon {
  font-size: 16px;
}

.action-content .tool-name {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}

.action-content .action-args {
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.action-content .args-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-content .args-content {
  background: white;
  border-radius: 6px;
  padding: 8px;
  overflow-x: auto;
}

.action-content .args-content code {
  font-size: 12px;
  color: #374151;
  font-family: 'Courier New', monospace;
}

.action-content .action-thought .thought-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-content .action-thought p {
  font-size: 13px;
  line-height: 1.6;
  color: #4b5563;
  font-style: italic;
  margin: 0;
}

.observation-content .observation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.observation-content .result-icon {
  font-size: 14px;
}

.observation-content .result-label {
  font-size: 13px;
  font-weight: 600;
  color: #065f46;
}

.observation-content .observation-data {
  background: white;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #d1fae5;
  overflow-x: auto;
}

.observation-content .observation-data pre {
  font-size: 13px;
  color: #374151;
  font-family: 'Courier New', monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>

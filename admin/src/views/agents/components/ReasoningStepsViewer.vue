<template>
  <div class="reasoning-steps-viewer">
    <div class="header">
      <h3>{{ $t('reasoningViewer.reasoningProcess') }}</h3>
      <el-tag :type="getModeTagType(reasoningMode)">
        {{ getModeLabel(reasoningMode) }}
      </el-tag>
    </div>

    <div v-if="steps.length === 0" class="empty">
      <el-empty :description="$t('reasoningViewer.noReasoningSteps')" :image-size="60" />
    </div>

    <el-timeline v-else>
      <el-timeline-item
        v-for="step in steps"
        :key="step.stepNumber"
        :type="getStepType(step.stepType)"
        :timestamp="step.createdAt ? formatTime(step.createdAt) : ''"
      >
        <ReasoningStepCard :step="step" />
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import type { ReasoningStep } from '@/api/agent'
import ReasoningStepCard from './ReasoningStepCard.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  steps: ReasoningStep[]
  reasoningMode: string
}

defineProps<Props>()

const getModeLabel = (mode: string) => {
  const labels: Record<string, string> = {
    NONE: t('reasoningViewer.defaultMode'),
    REACT: t('reasoningViewer.reactMode'),
    PLAN: t('reasoningViewer.planMode'),
    REFLECT: t('reasoningViewer.reflectMode'),
  }
  return labels[mode] || mode || t('reasoningViewer.defaultMode')
}

const getModeTagType = (mode: string) => {
  const types: Record<string, string> = {
    NONE: 'info',
    REACT: 'success',
    PLAN: 'warning',
    REFLECT: 'danger',
  }
  return types[mode] || 'info'
}

const getStepType = (stepType: string) => {
  const types: Record<string, string> = {
    thought: 'primary',
    action: 'success',
    observation: 'warning',
    final_answer: 'danger',
  }
  return types[stepType] || 'info'
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleString()
}
</script>

<style lang="scss" scoped>
.reasoning-steps-viewer {
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
    }
  }

  .empty {
    padding: 20px;
    text-align: center;
  }
}
</style>

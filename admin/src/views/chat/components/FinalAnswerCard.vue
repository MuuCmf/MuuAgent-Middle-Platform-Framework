<template>
  <div class="final-answer-card">
    <div class="final-answer-header">
      <div class="final-badge">
        <span class="final-icon">🎯</span>
        <span class="final-label">最终结论</span>
      </div>
      <div class="final-confidence">
        <span class="confidence-label">置信度</span>
        <div class="confidence-bar">
          <div class="confidence-fill"></div>
        </div>
        <span class="confidence-value">高</span>
      </div>
    </div>
    <div class="final-answer-body">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  content: string
}>()
</script>

<style lang="scss" scoped>
.final-answer-card {
  margin-top: 16px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
  box-shadow: 0 4px 16px rgba(22, 101, 52, 0.12);
}

.final-answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(22, 101, 52, 0.1);
}

.final-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(5, 150, 105, 0.1);
  border-radius: 20px;
}

.final-icon {
  font-size: 14px;
}

.final-label {
  font-size: 13px;
  font-weight: 600;
  color: #065f46;
}

.final-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confidence-label {
  font-size: 11px;
  color: #64748b;
}

.confidence-bar {
  width: 60px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  width: 85%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 3px;
}

.confidence-value {
  font-size: 11px;
  font-weight: 600;
  color: #059669;
}

.final-answer-body {
  padding: 16px 18px;
  font-size: 15px;
  line-height: 1.8;
  color: #1f2937;
  white-space: pre-wrap;
}
</style>

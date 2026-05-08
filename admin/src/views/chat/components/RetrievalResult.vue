<template>
  <div>
    <div v-if="results && results.length > 0">
      <div style="margin-bottom: 8px; color: #667eea; font-weight: 600;">
        📊 找到 {{ results.length }} 个相关结果：
      </div>
      <div v-for="(result, rIdx) in results" :key="rIdx" class="retrieval-result">
        <div class="result-index">{{ rIdx + 1 }}.</div>
        <div class="result-content">{{ result.content }}</div>
        <div class="result-meta">
          <span class="result-source">📄 来源：{{ result.docName }}</span>
          <span class="result-score">📊 相似度：{{ (result.score * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>
    <div v-else style="color: #999;">未找到相关内容</div>
  </div>
</template>

<script setup lang="ts">
import type { RetrievalItem } from '@/api/retrieval'

defineProps<{
  results?: RetrievalItem[]
}>()
</script>

<style lang="scss" scoped>
.retrieval-result {
  margin-bottom: 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #667eea;

  .result-index {
    font-weight: 600;
    color: #667eea;
    margin-bottom: 4px;
  }

  .result-content {
    color: #333;
    margin-bottom: 6px;
    line-height: 1.6;
  }

  .result-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #666;

    .result-source {
      color: #667eea;
    }

    .result-score {
      color: #52c41a;
    }
  }
}
</style>

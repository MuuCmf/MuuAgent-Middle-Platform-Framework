<template>
  <div class="rag-answer">
    <div class="rag-content">{{ content }}</div>
    <div v-if="sources && sources.length > 0" class="rag-sources">
      <div class="sources-title">📚 参考来源：</div>
      <div v-for="(source, sIdx) in sources" :key="sIdx" class="source-item">
        <span class="source-index">{{ sIdx + 1 }}.</span>
        <span class="source-name">{{ source.docName }}</span>
        <span class="source-score">（相似度：{{ (source.score * 100).toFixed(1) }}%）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RetrievalItem } from '../api/retrieval'

defineProps<{
  content: string
  sources?: RetrievalItem[]
}>()
</script>

<style scoped lang="scss">
.rag-answer {
  width: 100%;
}

.rag-content {
  white-space: pre-wrap;
  line-height: 1.8;
}

.rag-sources {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #e8e8e8;

  .sources-title {
    color: #667eea;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .source-item {
    padding: 6px 0;
    font-size: 13px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;

    .source-index {
      color: #999;
      font-size: 12px;
    }

    .source-name {
      color: #333;
    }

    .source-score {
      color: #52c41a;
      font-size: 12px;
    }
  }
}
</style>

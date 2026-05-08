<template>
  <div>
    <div class="rag-content">{{ content }}</div>
    <div v-if="sources && sources.length > 0" class="rag-sources">
      <div class="sources-title">📚 参考来源：</div>
      <div v-for="(source, sIdx) in sources" :key="sIdx" class="source-item">
        <span>• {{ source.docName }}</span>
        <span class="source-score">（相似度：{{ (source.score * 100).toFixed(1) }}%）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RetrievalItem } from '@/api/retrieval'

defineProps<{
  content: string
  sources?: RetrievalItem[]
}>()
</script>

<style lang="scss" scoped>
.rag-content {
  white-space: pre-wrap;
}

.rag-sources {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e8e8e8;

  .sources-title {
    color: #667eea;
    font-weight: 600;
  }

  .source-item {
    padding: 4px 0;
    font-size: 13px;
    color: #666;

    .source-score {
      color: #52c41a;
      margin-left: 8px;
    }
  }
}
</style>

<template>
  <div class="rag-answer">
    <!-- 思考内容 -->
    <div v-if="thinkingContent && thinkingContent.trim()" class="thinking-section">
      <div class="thinking-icon">💭</div>
      <div class="thinking-content">{{ thinkingContent }}</div>
    </div>
    
    <!-- 回答内容 -->
    <div class="rag-content">{{ content }}</div>
    
    <!-- 参考来源 -->
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
import type { RetrievalItem } from '../../../api/retrieval'

defineProps<{
  content: string
  thinkingContent?: string
  sources?: RetrievalItem[]
}>()
</script>

<style scoped lang="scss">
.rag-answer {
  width: 100%;
}

/* 思考内容样式 */
.thinking-section {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-radius: 8px;
  margin-bottom: 12px;
  border-left: 4px solid #ff9800;
  
  .thinking-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .thinking-content {
    flex: 1;
    white-space: pre-wrap;
    line-height: 1.8;
    color: #e65100;
    font-style: italic;
    font-size: 14px;
  }
}

/* 回答内容样式 */
.rag-content {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #333;
}

/* 参考来源样式 */
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

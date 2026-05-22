<template>
  <div class="rag-answer">
    <!-- 思考内容 -->
    <div v-if="thinkingContent && thinkingContent.trim()" class="thinking-section">
      <div class="thinking-icon">💭</div>
      <div class="thinking-content">{{ thinkingContent }}</div>
    </div>
    
    <!-- 回答内容：使用 Markdown 组件渲染 -->
    <div class="rag-content">
      <Markdown
        :content="processedContent"
        :mode="isStreaming ? 'streaming' : 'static'"
        :controls="markdownControls"
        :codeOptions="codeOptions"
        :shikiOptions="shikiOptions"
      />
      <!-- 流式输出时的打字光标 -->
      <div v-if="isStreaming" class="typing-cursor">
        <span class="cursor"></span>
      </div>
    </div>
    
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
import { computed } from 'vue'
import type { RetrievalItem } from '../../../api/retrieval'
import { Markdown } from 'vue-stream-markdown'
import type { ControlsConfig, CodeOptions, ShikiOptions } from 'vue-stream-markdown'
import { preprocessMarkdown } from '../../../utils/markdown'
import 'vue-stream-markdown/index.css'
import '../../../styles/markdown.css'

const props = withDefaults(defineProps<{
  /** 回答内容 */
  content: string
  /** 思考过程内容 */
  thinkingContent?: string
  /** 参考来源列表 */
  sources?: RetrievalItem[]
  /** 是否正在流式输出 */
  isStreaming?: boolean
}>(), {
  isStreaming: false
})

/**
 * 预处理后的内容，修正 markdown 格式问题
 */
const processedContent = computed(() => {
  return preprocessMarkdown(props.content)
})

/** Markdown 控件配置 */
const markdownControls: ControlsConfig = {
  code: {
    copy: true,
    download: true,
    fullscreen: false,
    collapse: true
  },
  table: {
    copy: true,
    download: true,
    fullscreen: true
  },
  image: {
    preview: true,
    download: true
  }
}

/** 代码块渲染选项 */
const codeOptions: CodeOptions = {
  lineNumbers: true,
  languageIcon: true,
  languageName: true,
  maxHeight: '500px'
}

/** Shiki 主题配置 */
const shikiOptions: ShikiOptions = {
  theme: ['github-light', 'github-dark']
}
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
  line-height: 1.8;
  color: #333;
}

/* 打字光标样式 */
.typing-cursor {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
}

.typing-cursor .cursor {
  display: inline-block;
  width: 2px;
  height: 18px;
  background: #6366f1;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
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

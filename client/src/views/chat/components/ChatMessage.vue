<template>
  <div :class="['message', message.role]">
    <div class="message-avatar">
      <div v-if="message.role === 'user'" class="avatar user-avatar">
        <el-icon><User /></el-icon>
      </div>
    </div>
    <div class="message-content">
      <!-- 推理过程显示 -->
      <ReasoningProcess 
        v-if="message.role === 'assistant' && message.reasoningSteps && message.reasoningSteps.length > 0"
        :steps="message.reasoningSteps"
        :isStreaming="isStreaming"
      />
      
      <!-- RAG消息显示 -->
      <RagAnswer
        v-if="message.role === 'assistant' && message.type === 'rag'"
        :content="message.content"
        :sources="message.sources"
      />
      
      <!-- 检索结果显示 -->
      <div
        v-else-if="message.role === 'assistant' && message.type === 'retrieval' && message.results"
        class="retrieval-results"
      >
        <div class="results-title">🔍 检索结果（共 {{ message.results.length }} 条）</div>
        <div v-for="(result, idx) in message.results" :key="idx" class="result-item">
          <div class="result-header">
            <span class="result-index">{{ idx + 1 }}.</span>
            <span class="result-name">{{ result.docName }}</span>
            <span class="result-score">相似度: {{ (result.score * 100).toFixed(1) }}%</span>
          </div>
          <div class="result-content">{{ result.content }}</div>
        </div>
      </div>
      
      <!-- 用户消息：普通文本显示 -->
      <div 
        v-else-if="message.role === 'user'"
        class="message-text"
      >{{ message.content }}</div>
      
      <!-- AI消息：使用vue-stream-markdown渲染（流式返回） -->
      <template v-else-if="message.role === 'assistant' && !message.type">
        <Markdown
          :content="processedContent"
          :mode="isStreaming ? 'streaming' : 'static'"
          :controls="markdownControls"
          :codeOptions="codeOptions"
          :shikiOptions="shikiOptions"
          @copied="handleCopied"
        />
        
        <!-- 流式输出时的打字光标 -->
        <div v-if="isStreaming" class="typing-cursor">
          <span class="cursor"></span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Message } from '../../../api'
import ReasoningProcess from './ReasoningProcess.vue'
import RagAnswer from './RagAnswer.vue'
import { Markdown } from 'vue-stream-markdown'
import type { ControlsConfig, CodeOptions, ShikiOptions } from 'vue-stream-markdown'
import { preprocessMarkdown } from '../../../utils/markdown'
import 'vue-stream-markdown/index.css'
import '../../../styles/markdown.css'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const messageTextRef = ref<HTMLElement | null>(null)
let scrollContainer: HTMLElement | null = null

/**
 * 预处理后的内容
 */
const processedContent = computed(() => {
  const original = props.message.content
  
  if (original.includes('```')) {
    const allMatches = [...original.matchAll(/```(\w*)\n?/g)]
    allMatches.forEach((match, i) => {
      const startPos = match.index! + match[0].length
      const afterContent = original.substring(startPos, startPos + 15).replace(/\n/g, '\\n')
      console.log(`[组件接收数据] 代码块${i}: ${JSON.stringify(match[0])} 后续: "${afterContent}"`)
    })
  }
  
  const processed = preprocessMarkdown(original)
  
  if (original !== processed) {
    console.log('[Markdown预处理]', {
      原始内容: original.substring(0, 200),
      处理后: processed.substring(0, 200)
    })
  }
  
  return processed
})

// 配置Markdown渲染选项
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

// 配置代码块渲染选项
const codeOptions: CodeOptions = {

  lineNumbers: true,
  languageIcon: true,
  languageName: true,
  maxHeight: '500px'
}

// 配置Shiki主题
const shikiOptions: ShikiOptions = {
  theme: ['github-light', 'github-dark']
}

function handleCopied(): void {
  ElMessage.success('代码已复制到剪贴板')
}

// 查找滚动容器
function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent)
    if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

onMounted(() => {
  if (messageTextRef.value) {
    scrollContainer = findScrollContainer(messageTextRef.value)
  }
})

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer = null
  }
})
</script>

<style scoped lang="scss">
.message {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  animation: fadeIn 0.3s ease-in-out;
  min-height: fit-content;
  height: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.assistant-avatar {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.message-content {
  flex: 1;
  max-width: 70%;
  min-height: fit-content;
  height: auto;
}

.message.user .message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-text {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 12px;
  line-height: 1.8;
  word-wrap: break-word;
  min-height: fit-content;
  height: auto;
  width: fit-content;
  max-width: 100%;
}

.message.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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

/* 检索结果样式 */
.retrieval-results {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  width: 100%;
  min-height: fit-content;
  height: auto;

  .results-title {
    font-size: 14px;
    font-weight: 600;
    color: #667eea;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e8e8e8;
  }

  .result-item {
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e8e8e8;
    min-height: fit-content;
    height: auto;

    &:last-child {
      margin-bottom: 0;
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .result-index {
        color: #999;
        font-size: 12px;
      }

      .result-name {
        font-weight: 500;
        color: #333;
      }

      .result-score {
        margin-left: auto;
        font-size: 12px;
        color: #52c41a;
        background: #f6ffed;
        padding: 2px 8px;
        border-radius: 4px;
      }
    }

    .result-content {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}
</style>


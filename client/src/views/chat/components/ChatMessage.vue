<template>
  <div :class="['message', message.role, { 'message-grouped': isGrouped }]">
    <div v-if="showAvatar" class="message-avatar">
      <div v-if="message.role === 'user'" class="avatar user-avatar">
        <el-icon><User /></el-icon>
      </div>
      <div v-else class="avatar assistant-avatar">
        <el-icon><Monitor /></el-icon>
      </div>
    </div>
    <div v-else class="avatar-spacer" />

    <div class="message-body">
      <div v-if="showSender" class="message-sender">
        <span class="sender-name">{{ message.role === 'user' ? '你' : 'AI助手' }}</span>
        <span v-if="message.type === 'rag'" class="sender-badge rag-badge">RAG</span>
        <span v-if="message.type === 'retrieval'" class="sender-badge retrieval-badge">检索</span>
      </div>

      <div class="message-content">
        <ReasoningProcess
          v-if="message.role === 'assistant' && message.reasoningSteps && message.reasoningSteps.length > 0"
          :steps="message.reasoningSteps"
          :isStreaming="isStreaming"
        />

        <RagAnswer
          v-if="message.role === 'assistant' && message.type === 'rag'"
          :content="message.content"
          :thinking-content="message.thinkingContent"
          :sources="message.sources"
          :is-streaming="isStreaming"
        />

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

        <div
          v-else-if="message.role === 'user'"
          class="message-text user-text"
        >{{ message.content }}</div>

        <template v-else-if="message.role === 'assistant' && !message.type">
          <template v-if="message.contentBlocks && message.contentBlocks.length > 0">
            <div
              v-for="(block, idx) in visibleBlocks"
              :key="`block-${idx}`"
              class="content-block"
            >
              <!-- 文本块 -->
              <div v-if="block.type === 'text'" class="content-block-text">
                <Markdown
                  :content="block.content"
                  :mode="isStreaming ? 'streaming' : 'static'"
                  :controls="markdownControls"
                  :codeOptions="codeOptions"
                  :shikiOptions="shikiOptions"
                  @copied="handleCopied"
                />
              </div>

              <!-- 工具调用块 -->
              <div v-else-if="block.type === 'tool_call'" class="content-block-tool">
                <div class="tool-card" :class="block.toolStatus">
                  <div class="tool-header">
                    <span class="tool-status-icon">{{ toolStatusConfig[block.toolStatus || 'running']?.icon || '🔧' }}</span>
                    <span class="tool-name">工具调用: {{ block.toolName || '未知工具' }}</span>
                    <span class="tool-status-label">{{ toolStatusConfig[block.toolStatus || 'running']?.label || '' }}</span>
                    <span v-if="block.toolStatus === 'running'" class="tool-spinner"></span>
                  </div>
                  <div v-if="block.toolArgs && Object.keys(block.toolArgs).length > 0" class="tool-args">
                    <pre>{{ JSON.stringify(block.toolArgs, null, 2) }}</pre>
                  </div>
                  <div v-if="block.toolStatus === 'completed' && block.toolResult !== undefined" class="tool-result">
                    <pre>{{ typeof block.toolResult === 'string' ? block.toolResult : JSON.stringify(block.toolResult, null, 2) }}</pre>
                  </div>
                  <div v-if="block.toolStatus === 'error'" class="tool-error">
                    错误: {{ block.content || '工具执行失败' }}
                  </div>
                </div>
              </div>

              <!-- 思考块 -->
              <div v-else-if="block.type === 'thinking'" class="content-block-thinking">
                <div class="thinking-block-header" @click="toggleThinkingBlock(idx)">
                  <span class="thinking-icon">💭</span>
                  <span class="thinking-label">思考过程</span>
                  <el-icon :size="12" class="thinking-toggle">
                    <component :is="thinkingBlockExpanded[idx] !== false ? 'ArrowUp' : 'ArrowDown'" />
                  </el-icon>
                </div>
                <div v-show="thinkingBlockExpanded[idx] !== false" class="thinking-block-content">
                  <pre>{{ block.content }}</pre>
                </div>
              </div>

              <div v-if="block.type === 'text' && isStreaming" class="block-cursor">
                <span class="cursor" />
              </div>
            </div>

            <!-- 兜底：如果没有 contentBlocks，显示原始 content -->
            <div v-if="!hasAnyBlock && message.content" class="content-block-text fallback-text">
              <Markdown
                :content="processedContent"
                :mode="isStreaming ? 'streaming' : 'static'"
                :controls="markdownControls"
                :codeOptions="codeOptions"
                :shikiOptions="shikiOptions"
                @copied="handleCopied"
              />
            </div>

            <div v-if="isStreaming" class="typing-cursor">
              <span class="cursor" />
            </div>
          </template>

          <template v-else>
            <div v-if="message.thinkingContent && message.thinkingContent.trim()" class="thinking-section">
              <div class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
                <span class="thinking-icon">💭</span>
                <span class="thinking-label">思考过程</span>
                <el-icon :size="12" class="thinking-toggle">
                  <component :is="thinkingExpanded ? 'ArrowUp' : 'ArrowDown'" />
                </el-icon>
              </div>
              <div v-show="thinkingExpanded" class="thinking-content">{{ message.thinkingContent }}</div>
            </div>

            <Markdown
              :content="processedContent"
              :mode="isStreaming ? 'streaming' : 'static'"
              :controls="markdownControls"
              :codeOptions="codeOptions"
              :shikiOptions="shikiOptions"
              @copied="handleCopied"
            />

            <div v-if="isStreaming" class="typing-cursor">
              <span class="cursor" />
            </div>
          </template>
        </template>
      </div>

      <div v-if="showTimestamp" class="message-meta">
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { User, Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Message, ContentBlock } from '../../../api'
import ReasoningProcess from './ReasoningProcess.vue'
import RagAnswer from './RagAnswer.vue'
import { Markdown } from 'vue-stream-markdown'
import type { ControlsConfig, CodeOptions, ShikiOptions } from 'vue-stream-markdown'
import { preprocessMarkdown } from '../../../utils/markdown'
import 'vue-stream-markdown/index.css'
import '../../../styles/markdown.scss'

interface Props {
  /** 消息对象 */
  message: Message
  /** 是否正在流式输出 */
  isStreaming?: boolean
  /** 是否分组显示（连续同一角色时隐藏头像） */
  isGrouped?: boolean
  /** 是否显示发送者名称 */
  showSender?: boolean
  /** 是否显示时间戳 */
  showTimestamp?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  isGrouped: false,
  showSender: false,
  showTimestamp: false,
})

/** 思考内容展开状态 */
const thinkingExpanded = ref(true)

/** 思考块展开状态（按索引） */
const thinkingBlockExpanded = ref<Record<number, boolean>>({})

/**
 * 切换思考块展开状态
 * @param idx 块索引
 */
const toggleThinkingBlock = (idx: number) => {
  thinkingBlockExpanded.value = {
    ...thinkingBlockExpanded.value,
    [idx]: thinkingBlockExpanded.value[idx] !== false ? false : true,
  }
}

/**
 * 监听 contentBlocks 中 thinking 块完成并自动收起
 */
watch(
  () => props.message.contentBlocks,
  (blocks) => {
    if (!blocks) return
    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx]
      if (b.type === 'thinking' && b.toolStatus === 'completed') {
        thinkingBlockExpanded.value = {
          ...thinkingBlockExpanded.value,
          [idx]: false,
        }
      }
    }
  },
  { deep: true },
)

/**
 * 是否显示头像
 */
const showAvatar = computed(() => !props.isGrouped)

/**
 * 预处理后的内容
 */
const processedContent = computed(() => {
  return preprocessMarkdown(props.message.content)
})

/**
 * contentBlocks 中是否有任何块
 */
const hasAnyBlock = computed(() => {
  return props.message.contentBlocks && props.message.contentBlocks.length > 0
})

/**
 * 过滤掉空的思考块（无内容且无推理步骤）
 */
const visibleBlocks = computed(() => {
  const blocks = props.message.contentBlocks
  if (!blocks) return []
  return blocks.filter(b => {
    if (b.type !== 'thinking') return true
    return (b.content && b.content.length > 0) || (b.reasoningSteps && b.reasoningSteps.length > 0)
  })
})

/** Markdown 控件配置 */
const markdownControls: ControlsConfig = {
  code: {
    copy: true,
    download: true,
    fullscreen: false,
    collapse: true,
  },
  table: {
    copy: true,
    download: true,
    fullscreen: true,
  },
  image: {
    preview: true,
    download: true,
  },
}

/** 代码块配置 */
const codeOptions: CodeOptions = {
  lineNumbers: true,
  languageIcon: true,
  languageName: true,
  maxHeight: '500px',
}

/** Shiki 高亮配置 */
const shikiOptions: ShikiOptions = {
  theme: ['github-light', 'github-dark'],
}

/**
 * 复制成功回调
 */
const handleCopied = (): void => {
  ElMessage.success('代码已复制到剪贴板')
}

/**
 * 格式化时间戳
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串
 */
const formatTime = (timestamp?: number | string): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** 工具状态图标映射 */
const toolStatusConfig: Record<string, { icon: string; label: string }> = {
  running: { icon: '⏳', label: '执行中' },
  completed: { icon: '✅', label: '已完成' },
  error: { icon: '❌', label: '失败' },
  streaming: { icon: '📝', label: '生成中' },
}
</script>

<style lang="scss" scoped>
.message {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  animation: fadeIn 0.3s ease-in-out;

  &.message-grouped {
    padding-top: 4px;
  }

  &.user {
    flex-direction: row-reverse;

    .message-body {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
  }

  &.assistant .message-text {
    background: var(--bg-tertiary);
    border-bottom-left-radius: 4px;
    color: var(--text-color);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar-spacer {
  width: 40px;
  flex-shrink: 0;
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
  background: var(--primary-gradient);
}

.assistant-avatar {
  background: var(--secondary-gradient);
}

.message-body {
  flex: 1;
  max-width: 75%;
  min-width: 0;
}

.message-sender {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sender-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.sender-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.rag-badge {
  background: #ecf5ff;
  color: #409eff;
}

.retrieval-badge {
  background: #fdf6ec;
  color: #e6a23c;
}

.message-content {
  min-width: 0;
}

.message-text {
  padding: 14px 18px;
  border-radius: 16px;
  line-height: 1.8;
  word-wrap: break-word;
  width: fit-content;
  max-width: 100%;
}

.user-text {
  background: var(--primary-gradient);
  color: white;
  border-bottom-right-radius: 4px;
}

.typing-cursor {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;

  .cursor {
    display: inline-block;
    width: 2px;
    height: 18px;
    background: var(--primary-color);
    animation: blink 1s infinite;
    margin-left: 2px;
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.retrieval-results {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 16px;
  width: 100%;

  .results-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .result-item {
    padding: 12px;
    margin-bottom: 8px;
    background: var(--white);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);

    &:last-child {
      margin-bottom: 0;
    }
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .result-index {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .result-name {
    font-weight: 500;
    color: var(--text-color);
  }

  .result-score {
    margin-left: auto;
    font-size: 12px;
    color: #52c41a;
    background: #f6ffed;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .result-content {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.thinking-section {
  margin-bottom: 12px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #ffe0b2;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);

  html.dark & {
    border-color: #5d4037;
    background: linear-gradient(135deg, #3e2723 0%, #4e342e 100%);
  }

  .thinking-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 152, 0, 0.08);
    }
  }

  .thinking-icon {
    font-size: 16px;
  }

  .thinking-label {
    font-size: 13px;
    font-weight: 600;
    color: #e65100;

    html.dark & {
      color: #ffb74d;
    }
  }

  .thinking-toggle {
    color: #e65100;
    margin-left: auto;

    html.dark & {
      color: #ffb74d;
    }
  }

  .thinking-content {
    padding: 0 14px 12px;
    white-space: pre-wrap;
    line-height: 1.8;
    color: #bf360c;
    font-style: italic;
    font-size: 13px;
    border-top: 1px solid #ffe0b2;
    padding-top: 10px;

    html.dark & {
      color: #ffcc80;
      border-top-color: #5d4037;
    }
  }
}

.content-block {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.content-block-text {
  :deep(.markdown-body) {
    background: var(--bg-tertiary);
    border-radius: 12px;
    padding: 14px 18px;
    border-bottom-left-radius: 4px;
  }

  &.fallback-text {
    margin-top: 8px;

    :deep(.markdown-body) {
      border-left: 3px solid var(--primary-color);
    }
  }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 18px;
    background: var(--primary-color);
    animation: blink 1s infinite;
    margin-left: 2px;
  }
}

.content-block-tool {
  .tool-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.3s;

    &.running {
      border-color: #faad14;
      background: linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%);

      html.dark & {
        border-color: #d48806;
        background: linear-gradient(135deg, #3e2723 0%, #4e342e 100%);
      }
    }

    &.completed {
      border-color: #52c41a;
    }

    &.error {
      border-color: #ff4d4f;
    }
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;

    .tool-status-icon {
      font-size: 16px;
    }

    .tool-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color);
      flex: 1;
    }

    .tool-status-label {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .tool-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #faad14;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  .tool-args,
  .tool-result {
    padding: 8px 14px 12px;
    border-top: 1px solid var(--border-color);

    pre {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }
  }

  .tool-error {
    padding: 8px 14px 12px;
    border-top: 1px solid #ff4d4f;
    font-size: 12px;
    color: #ff4d4f;
  }
}

.content-block-thinking {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-secondary, #f9fafb);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--text-tertiary, #9ca3af);
  }

  html.dark & {
    background: var(--bg-secondary, #1f2937);
  }

  .thinking-block-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;

    &:hover {
      background: var(--hover-bg, rgba(0,0,0,0.03));

      html.dark & {
        background: var(--hover-bg, rgba(255,255,255,0.04));
      }
    }

    .thinking-icon {
      font-size: 14px;
      opacity: 0.6;
    }

    .thinking-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary, #9ca3af);
      letter-spacing: 0.3px;
    }

    .thinking-toggle {
      margin-left: auto;
      color: var(--text-tertiary, #9ca3af);
      transition: transform 0.2s;
      font-size: 11px;
    }
  }

  .thinking-block-content {
    border-top: 1px solid var(--border-color, #e5e7eb);

    pre {
      margin: 0;
      padding: 10px 12px;
      white-space: pre-wrap;
      line-height: 1.7;
      font-size: 13px;
      color: var(--text-secondary, #6b7280);
      font-family: inherit;

      html.dark & {
        color: var(--text-secondary, #9ca3af);
      }
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.message-meta {
  margin-top: 6px;

  .message-time {
    font-size: 11px;
    color: var(--text-tertiary);
  }
}

@media (max-width: 768px) {
  .message-body {
    max-width: 85%;
  }

  .avatar {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .avatar-spacer {
    width: 32px;
  }

  .message {
    gap: 8px;
    padding: 10px 0;
  }
}
</style>

<template>
  <div class="skill-md-preview">
    <!-- Frontmatter 元数据 -->
    <div v-if="frontmatter && Object.keys(frontmatter).length > 0" class="frontmatter-section">
      <h4>元数据 (Frontmatter)</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item v-if="frontmatter.name" label="Name" :span="2">
          <el-tag type="primary" size="small">{{ frontmatter.name }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="frontmatter.description" label="Description" :span="2">
          <span class="desc-text">{{ frontmatter.description }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="frontmatter.license" label="License">
          {{ frontmatter.license }}
        </el-descriptions-item>
        <el-descriptions-item v-if="frontmatter.compatibility" label="Compatibility" :span="2">
          {{ frontmatter.compatibility }}
        </el-descriptions-item>
        <el-descriptions-item v-if="frontmatter['allowed-tools']" label="Allowed Tools" :span="2">
          <el-tag
            v-for="tool in allowedToolsList"
            :key="tool"
            size="small"
            type="warning"
            style="margin-right: 4px;"
          >
            {{ tool }}
          </el-tag>
        </el-descriptions-item>
        <template v-if="frontmatter.metadata && Object.keys(frontmatter.metadata).length > 0">
          <el-descriptions-item
            v-for="(value, key) in frontmatter.metadata"
            :key="key"
            :label="key"
          >
            {{ value }}
          </el-descriptions-item>
        </template>
      </el-descriptions>
    </div>

    <!-- 正文内容 -->
    <div v-if="body" class="body-section">
      <h4>指令正文</h4>
      <div class="body-content markdown-body" v-html="renderedBody" />
    </div>

    <!-- 原始内容 -->
    <el-collapse v-if="rawContent" style="margin-top: 12px;">
      <el-collapse-item title="查看原始 SKILL.md">
        <pre class="raw-content">{{ rawContent }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  frontmatter?: Record<string, unknown> | null
  body?: string
  rawContent?: string
  /** 使用简单的换行转段落渲染，不依赖外部 markdown 库 */
}

const props = withDefaults(defineProps<Props>(), {
  frontmatter: null,
  body: '',
  rawContent: '',
})

const allowedToolsList = computed(() => {
  const tools = props.frontmatter?.['allowed-tools']
  if (typeof tools === 'string') return tools.split(/\s+/).filter(Boolean)
  return []
})

/** 简单 Markdown → HTML 渲染（不引入额外依赖） */
const renderedBody = computed(() => {
  if (!props.body) return ''
  let html = props.body
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // 标题
    .replace(/^#### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // 加粗/斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // 段落
    .replace(/\n\n/g, '</p><p>')
    // 单换行
    .replace(/\n/g, '<br>')

  return `<p>${html}</p>`
})
</script>

<style lang="scss" scoped>
.skill-md-preview {
  .frontmatter-section {
    margin-bottom: 16px;

    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    .desc-text {
      color: #606266;
      line-height: 1.6;
    }
  }

  .body-section {
    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    .body-content {
      background: #fafafa;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      padding: 16px;
      font-size: 13px;
      line-height: 1.7;
      color: #303133;

      :deep(h2) { font-size: 18px; margin: 16px 0 8px; }
      :deep(h3) { font-size: 16px; margin: 14px 0 6px; }
      :deep(h4) { font-size: 14px; margin: 12px 0 6px; }
      :deep(h5) { font-size: 13px; margin: 10px 0 4px; }

      :deep(.code-block) {
        background: #f0f0f0;
        padding: 10px 14px;
        border-radius: 4px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        overflow-x: auto;
        margin: 8px 0;
      }

      :deep(.inline-code) {
        background: #f0f0f0;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
      }

      :deep(ul) {
        padding-left: 20px;
        margin: 8px 0;
      }

      :deep(li) {
        margin: 4px 0;
      }

      :deep(strong) {
        font-weight: 600;
      }
    }
  }

  .raw-content {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>

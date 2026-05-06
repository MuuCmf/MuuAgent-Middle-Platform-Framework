<template>
  <div class="mcp-server-card">
    <div class="card-header">
      <div class="card-title">
        <el-icon class="server-icon"><Monitor /></el-icon>
        <span class="server-name">{{ config.name }}</span>
      </div>
      <div class="card-actions">
        <el-button size="small" @click="handleTest" :loading="testing">
          测试
        </el-button>
        <el-button size="small" type="danger" @click="handleDelete">
          删除
        </el-button>
      </div>
    </div>

    <div class="card-body">
      <div class="info-row">
        <span class="label">URL:</span>
        <span class="value url">{{ config.url }}</span>
      </div>

      <div v-if="config.tools && config.tools.length > 0" class="info-row">
        <span class="label">工具:</span>
        <div class="tools-list">
          <el-tag
            v-for="tool in config.tools"
            :key="tool"
            size="small"
            type="info"
            style="margin-right: 4px; margin-bottom: 4px;"
          >
            {{ tool }}
          </el-tag>
        </div>
      </div>

      <div class="info-row">
        <span class="label">状态:</span>
        <el-tag :type="statusType" size="small">
          {{ statusText }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor } from '@element-plus/icons-vue'
import { mcpServerApi, type McpServerConfig } from '@/api/mcp-server'

interface Props {
  config: McpServerConfig
}

interface Emits {
  (e: 'delete'): void
  (e: 'edit'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const testing = ref(false)
const connectionStatus = ref<'unknown' | 'success' | 'error'>('unknown')

const statusType = computed(() => {
  switch (connectionStatus.value) {
    case 'success':
      return 'success'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'success':
      return '已连接'
    case 'error':
      return '连接失败'
    default:
      return '未测试'
  }
})

const handleTest = async () => {
  testing.value = true

  try {
    const res = await mcpServerApi.testConnection({
      url: props.config.url,
      apiKey: props.config.apiKey,
      timeout: props.config.timeout
    })

    connectionStatus.value = res.data.data.success ? 'success' : 'error'
    ElMessage.success(res.data.data.message)
  } catch (error: any) {
    connectionStatus.value = 'error'
    ElMessage.error(error.response?.data?.message || '测试连接失败')
  } finally {
    testing.value = false
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定删除 MCP Server "${props.config.name}" 吗？`,
      '提示',
      {
        type: 'warning'
      }
    )

    emit('delete')
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
.mcp-server-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: #fafafa;
  transition: all 0.3s;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.server-icon {
  font-size: 20px;
  color: #409eff;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
}

.label {
  color: #909399;
  min-width: 60px;
  flex-shrink: 0;
}

.value {
  color: #606266;
  word-break: break-all;

  &.url {
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }
}

.tools-list {
  flex: 1;
}
</style>

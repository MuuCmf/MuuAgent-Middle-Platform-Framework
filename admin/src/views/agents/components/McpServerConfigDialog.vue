<template>
  <el-dialog
    v-model="visible"
    :title="editingConfig ? '编辑 MCP Server' : '添加 MCP Server'"
    width="700px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form :model="form" label-width="120px" :rules="rules" ref="formRef">
      <el-form-item label="名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="用于工具命名前缀，如：filesystem"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="URL" prop="url">
        <el-input
          v-model="form.url"
          placeholder="MCP Server HTTP端点地址，如：http://localhost:8081/mcp"
        />
      </el-form-item>

      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          placeholder="可选，用于认证"
          show-password
        />
      </el-form-item>

      <el-form-item label="超时时间">
        <el-input-number
          v-model="form.timeout"
          :min="1000"
          :max="120000"
          :step="1000"
          style="width: 200px;"
        />
        <span style="margin-left: 8px; color: #909399;">毫秒</span>
      </el-form-item>

      <el-divider>工具筛选</el-divider>

      <el-form-item label="">
        <el-radio-group v-model="toolFilterType" @change="handleToolFilterTypeChange">
          <el-radio value="all">允许所有工具</el-radio>
          <el-radio value="selected">仅允许指定工具</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="toolFilterType === 'selected'" label="">
        <div class="tool-filter-container">
          <div v-if="discoveredTools.length === 0" class="no-tools-tip">
            <el-empty description="暂未发现工具，请先点击下方按钮发现工具" :image-size="80" />
          </div>
          <div v-else class="tool-checkbox-group">
            <el-checkbox
              v-for="tool in discoveredTools"
              :key="tool.name"
              :value="tool.name"
              v-model="selectedTools"
            >
              <div class="tool-item">
                <span class="tool-name">{{ tool.name }}</span>
                <span class="tool-desc">{{ tool.description }}</span>
              </div>
            </el-checkbox>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="">
        <el-button @click="handleDiscoverTools" :loading="discovering">
          <el-icon><Search /></el-icon>
          发现工具
        </el-button>
        <el-button @click="handleTestConnection" :loading="testing">
          <el-icon><Connection /></el-icon>
          测试连接
        </el-button>
      </el-form-item>

      <el-form-item v-if="testResult" label="">
        <el-alert
          :title="testResult.success ? '连接成功' : '连接失败'"
          :type="testResult.success ? 'success' : 'error'"
          :description="testResult.message"
          show-icon
          :closable="false"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :disabled="!canSave">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Connection } from '@element-plus/icons-vue'
import { mcpServerApi, type McpServerConfig, type ToolDescription } from '@/api/mcp-server'
import type { FormInstance, FormRules } from 'element-plus'

interface Props {
  modelValue: boolean
  config?: McpServerConfig | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', config: McpServerConfig): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const editingConfig = computed(() => props.config)

const formRef = ref<FormInstance>()
const form = ref<McpServerConfig>({
  name: '',
  url: '',
  apiKey: '',
  tools: [],
  timeout: 30000,
  enabled: true
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符', trigger: 'blur' }
  ],
  url: [
    { required: true, message: '请输入URL', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
  ]
}

const toolFilterType = ref<'all' | 'selected'>('all')
const selectedTools = ref<string[]>([])
const discoveredTools = ref<ToolDescription[]>([])
const discovering = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const canSave = computed(() => {
  return form.value.name && form.value.url
})

watch(visible, (newVal) => {
  if (newVal && editingConfig.value) {
    form.value = { ...editingConfig.value }
    if (form.value.tools && form.value.tools.length > 0) {
      toolFilterType.value = 'selected'
      selectedTools.value = form.value.tools
    } else {
      toolFilterType.value = 'all'
      selectedTools.value = []
    }
  } else if (newVal) {
    resetForm()
  }
})

const resetForm = () => {
  form.value = {
    name: '',
    url: '',
    apiKey: '',
    tools: [],
    timeout: 30000,
    enabled: true
  }
  toolFilterType.value = 'all'
  selectedTools.value = []
  discoveredTools.value = []
  testResult.value = null
  formRef.value?.resetFields()
}

const handleToolFilterTypeChange = () => {
  if (toolFilterType.value === 'all') {
    selectedTools.value = []
  }
}

const handleDiscoverTools = async () => {
  if (!form.value.url) {
    ElMessage.warning('请先输入URL')
    return
  }

  discovering.value = true
  testResult.value = null

  try {
    const res = await mcpServerApi.discoverTools({
      url: form.value.url,
      apiKey: form.value.apiKey,
      timeout: form.value.timeout
    })

    discoveredTools.value = res.data.data.tools || []
    ElMessage.success(`发现 ${discoveredTools.value.length} 个工具`)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '发现工具失败')
    discoveredTools.value = []
  } finally {
    discovering.value = false
  }
}

const handleTestConnection = async () => {
  if (!form.value.url) {
    ElMessage.warning('请先输入URL')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const res = await mcpServerApi.testConnection({
      url: form.value.url,
      apiKey: form.value.apiKey,
      timeout: form.value.timeout
    })

    testResult.value = res.data.data
  } catch (error: any) {
    testResult.value = {
      success: false,
      message: error.response?.data?.message || '测试连接失败'
    }
  } finally {
    testing.value = false
  }
}

const handleSave = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      const config: McpServerConfig = {
        ...form.value,
        tools: toolFilterType.value === 'selected' ? selectedTools.value : []
      }

      emit('save', config)
      handleClose()
    }
  })
}

const handleClose = () => {
  visible.value = false
  resetForm()
}
</script>

<style lang="scss" scoped>
.tool-filter-container {
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px;
}

.no-tools-tip {
  padding: 20px;
  text-align: center;
}

.tool-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-name {
  font-weight: 500;
  color: #303133;
}

.tool-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>

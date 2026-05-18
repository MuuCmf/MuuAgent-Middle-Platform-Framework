<template>
  <el-drawer
    :model-value="modelValue"
    :title="mode === 'create' ? '新建 MCP Server' : '编辑 MCP Server'"
    direction="rtl"
    size="500px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="top"
    >
      <el-form-item label="名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="唯一标识，如 filesystem"
          :disabled="mode === 'edit'"
        />
        <div class="form-tip">名称只能包含字母、数字、下划线和连字符，且以字母开头</div>
      </el-form-item>

      <el-form-item label="显示名称" prop="displayName">
        <el-input v-model="form.displayName" placeholder="如：文件系统服务" />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="MCP Server 的功能描述"
        />
      </el-form-item>

      <el-form-item label="URL" prop="url">
        <el-input v-model="form.url" placeholder="http://localhost:8081/mcp" />
      </el-form-item>

      <el-form-item label="API Key" prop="apiKey">
        <div class="api-key-wrapper">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="hasExistingApiKey ? '已设置，留空保留原值' : '可选，用于认证'"
            :disabled="clearApiKey"
          />
          <el-checkbox
            v-if="mode === 'edit' && hasExistingApiKey"
            v-model="clearApiKey"
            label="清空 API Key"
          />
        </div>
        <div class="form-tip" v-if="mode === 'edit' && hasExistingApiKey && !clearApiKey">
          <el-icon><InfoFilled /></el-icon>
          已保存 API Key，输入新值将覆盖
        </div>
      </el-form-item>

      <el-form-item label="超时时间 (ms)" prop="timeout">
        <el-input-number
          v-model="form.timeout"
          :min="1000"
          :max="300000"
          :step="1000"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="允许的工具" prop="tools">
        <el-select
          v-model="form.tools"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="输入工具名称后按回车添加"
          style="width: 100%"
        />
        <div class="form-tip">留空则允许所有工具，或指定允许的工具名称列表</div>
      </el-form-item>

      <el-form-item label="状态" prop="enabled">
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
      </el-form-item>
    </el-form>

    <div class="drawer-footer">
      <el-button @click="handleTestConnection" :loading="testLoading">
        <el-icon><Connection /></el-icon>
        测试连接
      </el-button>
      <el-button @click="handleDiscoverTools" :loading="discoverLoading">
        <el-icon><Search /></el-icon>
        发现工具
      </el-button>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
        {{ mode === 'create' ? '创建' : '保存' }}
      </el-button>
    </div>

    <el-dialog
      v-model="toolsDialogVisible"
      title="发现的工具"
      width="600px"
      append-to-body
    >
      <el-table :data="discoveredTools" stripe max-height="400">
        <el-table-column prop="name" label="工具名称" min-width="150" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="toolsDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleAddAllTools">
          添加全部工具
        </el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Search, InfoFilled } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { mcpServerApi, type McpServer, type ToolDescription } from '@/api/mcp-server'

interface Props {
  modelValue: boolean
  server: McpServer | null
  mode: 'create' | 'edit'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const testLoading = ref(false)
const discoverLoading = ref(false)
const toolsDialogVisible = ref(false)
const discoveredTools = ref<ToolDescription[]>([])
const clearApiKey = ref(false)

const form = reactive({
  name: '',
  displayName: '',
  description: '',
  url: '',
  apiKey: '',
  timeout: 30000,
  enabled: true,
  tools: [] as string[],
})

const hasExistingApiKey = computed(() => {
  return props.mode === 'edit' && props.server?.hasApiKey === true
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '名称必须以字母开头，只能包含字母、数字、下划线和连字符',
      trigger: 'blur',
    },
  ],
  url: [
    { required: true, message: '请输入 URL', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL', trigger: 'blur' },
  ],
  timeout: [
    { required: true, message: '请输入超时时间', trigger: 'blur' },
  ],
}

const resetForm = () => {
  form.name = ''
  form.displayName = ''
  form.description = ''
  form.url = ''
  form.apiKey = ''
  form.timeout = 30000
  form.enabled = true
  form.tools = []
  clearApiKey.value = false
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      clearApiKey.value = false
      if (props.server && props.mode === 'edit') {
        form.name = props.server.name
        form.displayName = props.server.displayName || ''
        form.description = props.server.description || ''
        form.url = props.server.url
        form.apiKey = ''
        form.timeout = props.server.timeout || 30000
        form.enabled = props.server.enabled
        form.tools = props.server.tools || []
      } else {
        resetForm()
      }
    }
  }
)

const handleClose = () => {
  emit('update:modelValue', false)
  formRef.value?.resetFields()
}

const handleTestConnection = async () => {
  if (!form.url) {
    ElMessage.warning('请先输入 URL')
    return
  }

  testLoading.value = true
  try {
    const { data } = await mcpServerApi.testConnection({
      serverId: props.mode === 'edit' ? props.server?.id : undefined,
      url: form.url,
      apiKey: form.apiKey || undefined,
      timeout: form.timeout,
    })
    if (data.data.success) {
      ElMessage.success(`连接成功: ${data.data.message}`)
    } else {
      ElMessage.error(`连接失败: ${data.data.message}`)
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    ElMessage.error('测试连接失败')
  } finally {
    testLoading.value = false
  }
}

const handleDiscoverTools = async () => {
  if (!form.url) {
    ElMessage.warning('请先输入 URL')
    return
  }

  discoverLoading.value = true
  try {
    const { data } = await mcpServerApi.discoverTools({
      serverId: props.mode === 'edit' ? props.server?.id : undefined,
      url: form.url,
      apiKey: form.apiKey || undefined,
      timeout: form.timeout,
    })
    discoveredTools.value = data.data.tools
    if (data.data.tools.length > 0) {
      toolsDialogVisible.value = true
    } else {
      ElMessage.info('未发现任何工具')
    }
  } catch (error) {
    console.error('发现工具失败:', error)
    ElMessage.error('发现工具失败')
  } finally {
    discoverLoading.value = false
  }
}

const handleAddAllTools = () => {
  const toolNames = discoveredTools.value.map(t => t.name)
  const existingTools = new Set(form.tools)
  toolNames.forEach(name => {
    if (!existingTools.has(name)) {
      form.tools.push(name)
    }
  })
  toolsDialogVisible.value = false
  ElMessage.success(`已添加 ${toolNames.length} 个工具`)
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitLoading.value = true
  try {
    if (props.mode === 'create') {
      await mcpServerApi.create({
        name: form.name,
        displayName: form.displayName || undefined,
        description: form.description || undefined,
        url: form.url,
        apiKey: form.apiKey || undefined,
        timeout: form.timeout,
        enabled: form.enabled,
        tools: form.tools.length > 0 ? form.tools : undefined,
      })
      ElMessage.success('创建成功')
    } else {
      await mcpServerApi.update(props.server!.id, {
        displayName: form.displayName || undefined,
        description: form.description || undefined,
        url: form.url,
        apiKey: clearApiKey.value ? null : form.apiKey || undefined,
        timeout: form.timeout,
        enabled: form.enabled,
        tools: form.tools.length > 0 ? form.tools : undefined,
      })
      ElMessage.success('保存成功')
    }
    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('保存失败:', error)
    ElMessage.error(error.response?.data?.message || '保存失败')
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.api-key-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;

  .el-input {
    flex: 1;
  }
}

.drawer-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

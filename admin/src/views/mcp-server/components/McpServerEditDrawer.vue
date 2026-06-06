<template>
  <el-drawer :model-value="modelValue"
    :title="mode === 'create' ? $t('mcp.editDrawer.createTitle') : $t('mcp.editDrawer.editTitle')" direction="rtl"
    size="550px" @close="handleClose">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item :label="$t('mcp.editDrawer.form.appCode')">
        <AppSelector
          v-model="form.appCode"
          :placeholder="$t('mcp.editDrawer.form.appCodePlaceholder')"
          clearable
        />
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.name')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('mcp.editDrawer.form.namePlaceholder')"
          :disabled="mode === 'edit'" />
        <div class="form-tip">{{ $t('mcp.editDrawer.form.nameTip') }}</div>
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.displayName')" prop="displayName">
        <el-input v-model="form.displayName" :placeholder="$t('mcp.editDrawer.form.displayNamePlaceholder')" />
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.description')" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="2"
          :placeholder="$t('mcp.editDrawer.form.descriptionPlaceholder')" />
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.transport')" prop="transport">
        <el-radio-group v-model="form.transport" @change="handleTransportChange">
          <el-radio-button value="http">HTTP</el-radio-button>
          <el-radio-button value="sse">SSE</el-radio-button>
          <el-radio-button value="stdio">stdio</el-radio-button>
        </el-radio-group>
        <div class="form-tip">
          <template v-if="form.transport === 'stdio'">
            {{ $t('mcp.editDrawer.form.transportTipStdio') }}
          </template>
          <template v-else>
            {{ $t('mcp.editDrawer.form.transportTipHttp') }}
          </template>
        </div>
      </el-form-item>

      <template v-if="form.transport === 'http' || form.transport === 'sse'">
        <el-form-item :label="$t('mcp.editDrawer.form.url')" prop="url">
          <el-input v-model="form.url" :placeholder="$t('mcp.editDrawer.form.urlPlaceholder')" />
        </el-form-item>
      </template>

      <template v-if="form.transport === 'stdio'">
        <el-form-item :label="$t('mcp.editDrawer.form.command')" prop="command">
          <el-input v-model="form.command" :placeholder="$t('mcp.editDrawer.form.commandPlaceholder')" />
          <div class="form-tip">{{ $t('mcp.editDrawer.form.commandTip') }}</div>
        </el-form-item>

        <el-form-item :label="$t('mcp.editDrawer.form.args')" prop="args">
          <el-input v-model="argsText" type="textarea" :rows="2"
            :placeholder="$t('mcp.editDrawer.form.argsPlaceholder')" />
          <div class="form-tip">{{ $t('mcp.editDrawer.form.argsTip') }}</div>
        </el-form-item>

        <el-form-item :label="$t('mcp.editDrawer.form.env')" prop="env">
          <div class="env-editor">
            <div v-for="(item, index) in envEntries" :key="index" class="env-entry">
              <el-input v-model="item.key" :placeholder="$t('mcp.editDrawer.form.envKeyPlaceholder')"
                style="width: 40%" />
              <el-input v-model="item.value" :placeholder="$t('mcp.editDrawer.form.envValuePlaceholder')"
                style="width: 40%" type="password" show-password />
              <el-button type="danger" :icon="Delete" circle @click="removeEnvEntry(index)" />
            </div>
            <el-button type="primary" link @click="addEnvEntry">
              <el-icon>
                <Plus />
              </el-icon> {{ $t('mcp.editDrawer.form.addEnvVar') }}
            </el-button>
          </div>
          <div class="form-tip">{{ $t('mcp.editDrawer.form.envTip') }}</div>
        </el-form-item>
      </template>

      <el-form-item :label="$t('mcp.editDrawer.form.apiKey')" prop="apiKey">
        <div class="api-key-wrapper">
          <el-input v-model="form.apiKey" type="password" show-password
            :placeholder="hasExistingApiKey ? $t('mcp.editDrawer.form.apiKeySetPlaceholder') : $t('mcp.editDrawer.form.apiKeyPlaceholder')"
            :disabled="clearApiKey" />
          <el-checkbox v-if="mode === 'edit' && hasExistingApiKey" v-model="clearApiKey"
            :label="$t('mcp.editDrawer.form.clearApiKey')" />
        </div>
        <div class="form-tip" v-if="mode === 'edit' && hasExistingApiKey && !clearApiKey">
          <el-icon>
            <InfoFilled />
          </el-icon>
          {{ $t('mcp.editDrawer.form.apiKeySavedTip') }}
        </div>
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.timeout')" prop="timeout">
        <el-input-number v-model="form.timeout" :min="1000" :max="300000" :step="1000" style="width: 100%" />
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.allowedTools')" prop="tools">
        <el-select v-model="form.tools" multiple filterable allow-create default-first-option
          :placeholder="$t('mcp.editDrawer.form.allowedToolsPlaceholder')" style="width: 100%" />
        <div class="form-tip">{{ $t('mcp.editDrawer.form.allowedToolsTip') }}</div>
      </el-form-item>

      <el-form-item :label="$t('mcp.editDrawer.form.status')" prop="enabled">
        <el-switch v-model="form.enabled" :active-text="$t('mcp.editDrawer.form.enable')"
          :inactive-text="$t('mcp.editDrawer.form.disable')" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleTestConnection" :loading="testLoading">
          <el-icon>
            <Connection />
          </el-icon>
          {{ $t('mcp.actions.testConnection') }}
        </el-button>
        <el-button @click="handleDiscoverTools" :loading="discoverLoading">
          <el-icon>
            <Search />
          </el-icon>
          {{ $t('mcp.actions.discoverTools') }}
        </el-button>
        <el-button @click="handleClose">{{ $t('mcp.actions.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
          {{ mode === 'create' ? $t('mcp.actions.create') : $t('mcp.actions.save') }}
        </el-button>
      </div>
    </template>

    <el-dialog v-model="toolsDialogVisible" :title="$t('mcp.editDrawer.toolsDialog.title')" width="600px"
      append-to-body>
      <el-table :data="discoveredTools" stripe max-height="400">
        <el-table-column prop="name" :label="$t('mcp.editDrawer.toolsDialog.toolName')" min-width="150" />
        <el-table-column prop="description" :label="$t('mcp.editDrawer.toolsDialog.toolDesc')" min-width="200"
          show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="toolsDialogVisible = false">{{ $t('mcp.actions.close') }}</el-button>
        <el-button type="primary" @click="handleAddAllTools">
          {{ $t('mcp.actions.addAllTools') }}
        </el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Connection, Search, InfoFilled, Plus, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { mcpServerApi, type McpServer, type ToolDescription, type McpTransport } from '@/api/mcp-server'
import AppSelector from '@/components/AppSelector.vue'

const { t } = useI18n()

interface EnvEntry {
  key: string
  value: string
}

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
const envEntries = ref<EnvEntry[]>([])
const argsText = ref('')

const form = reactive({
  name: '',
  displayName: '',
  description: '',
  appCode: '',
  transport: 'http' as McpTransport,
  url: '',
  command: '',
  args: [] as string[],
  env: {} as Record<string, string>,
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
    { required: true, message: t('mcp.editDrawer.validation.nameRequired'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: t('mcp.editDrawer.validation.namePattern'),
      trigger: 'blur',
    },
  ],
  transport: [
    { required: true, message: t('mcp.editDrawer.validation.transportRequired'), trigger: 'change' },
  ],
  url: [
    {
      validator: (_rule, value, callback) => {
        if ((form.transport === 'http' || form.transport === 'sse') && !value) {
          callback(new Error(t('mcp.messages.connectionFailed', { message: 'HTTP/SSE protocol requires URL' })))
        } else if (value) {
          try {
            new URL(value)
            callback()
          } catch {
            callback(new Error(t('mcp.messages.connectionFailed', { message: 'Please enter a valid URL' })))
          }
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  command: [
    {
      validator: (_rule, value, callback) => {
        if (form.transport === 'stdio' && !value) {
          callback(new Error(t('mcp.messages.connectionFailed', { message: 'stdio protocol requires command' })))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  timeout: [
    { required: true, message: t('mcp.editDrawer.validation.nameRequired'), trigger: 'blur' },
  ],
}

const handleTransportChange = () => {
  form.url = ''
  form.command = ''
  form.args = []
  argsText.value = ''
  envEntries.value = []
}

const parseArgsText = (text: string): string[] => {
  if (!text.trim()) return []
  const args: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim())
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args
}

const argsToText = (args: string[]): string => {
  return args.map(arg => {
    if (arg.includes(' ')) {
      return `"${arg}"`
    }
    return arg
  }).join(' ')
}

watch(argsText, (newVal) => {
  form.args = parseArgsText(newVal)
})

const addEnvEntry = () => {
  envEntries.value.push({ key: '', value: '' })
}

const removeEnvEntry = (index: number) => {
  envEntries.value.splice(index, 1)
}

const envEntriesToRecord = (): Record<string, string> => {
  const record: Record<string, string> = {}
  envEntries.value.forEach(entry => {
    if (entry.key.trim()) {
      record[entry.key.trim()] = entry.value
    }
  })
  return record
}

const recordToEnvEntries = (record: Record<string, string>) => {
  envEntries.value = Object.entries(record).map(([key, value]) => ({ key, value }))
}

const resetForm = () => {
  form.name = ''
  form.displayName = ''
  form.description = ''
  form.appCode = ''
  form.transport = 'http'
  form.url = ''
  form.command = ''
  form.args = []
  argsText.value = ''
  form.env = {}
  form.apiKey = ''
  form.timeout = 30000
  form.enabled = true
  form.tools = []
  envEntries.value = []
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
        form.appCode = props.server.appCode || ''
        form.transport = props.server.transport || 'http'
        form.url = props.server.url || ''
        form.command = props.server.command || ''
        form.args = props.server.args || []
        argsText.value = argsToText(form.args)
        form.env = props.server.env || {}
        recordToEnvEntries(form.env)
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
  if (form.transport === 'stdio') {
    if (!form.command) {
      ElMessage.warning(t('mcp.editDrawer.validation.commandRequired'))
      return
    }
  } else {
    if (!form.url) {
      ElMessage.warning(t('mcp.editDrawer.validation.urlRequired'))
      return
    }
  }

  testLoading.value = true
  try {
    const { data } = await mcpServerApi.testConnection({
      serverId: props.mode === 'edit' ? props.server?.id : undefined,
      transport: form.transport,
      url: form.url || undefined,
      command: form.command || undefined,
      args: form.args.length > 0 ? form.args : undefined,
      env: Object.keys(form.env).length > 0 ? form.env : undefined,
      apiKey: form.apiKey || undefined,
      timeout: form.timeout,
    })
    if (data.data.success) {
      ElMessage.success(t('mcp.messages.connectionSuccess', { latency: data.data.message }))
    } else {
      ElMessage.error(t('mcp.messages.connectionFailed', { message: data.data.message }))
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    ElMessage.error(t('mcp.messages.testConnectionFailed'))
  } finally {
    testLoading.value = false
  }
}

const handleDiscoverTools = async () => {
  if (form.transport === 'stdio') {
    if (!form.command) {
      ElMessage.warning(t('mcp.editDrawer.validation.commandRequired'))
      return
    }
  } else {
    if (!form.url) {
      ElMessage.warning(t('mcp.editDrawer.validation.urlRequired'))
      return
    }
  }

  discoverLoading.value = true
  try {
    const { data } = await mcpServerApi.discoverTools({
      serverId: props.mode === 'edit' ? props.server?.id : undefined,
      transport: form.transport,
      url: form.url || undefined,
      command: form.command || undefined,
      args: form.args.length > 0 ? form.args : undefined,
      env: Object.keys(form.env).length > 0 ? form.env : undefined,
      apiKey: form.apiKey || undefined,
      timeout: form.timeout,
    })
    discoveredTools.value = data.data.tools
    if (data.data.tools.length > 0) {
      toolsDialogVisible.value = true
    } else {
      ElMessage.info(t('mcp.messages.syncFailed'))
    }
  } catch (error) {
    console.error('发现工具失败:', error)
    ElMessage.error(t('mcp.messages.syncFailed'))
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
  ElMessage.success(t('mcp.messages.syncSuccess', { count: toolNames.length }))
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (!valid) return

  form.env = envEntriesToRecord()

  submitLoading.value = true
  try {
    if (props.mode === 'create') {
      await mcpServerApi.create({
        name: form.name,
        displayName: form.displayName || undefined,
        description: form.description || undefined,
        appCode: form.appCode || undefined,
        transport: form.transport,
        url: form.url || undefined,
        command: form.command || undefined,
        args: form.args.length > 0 ? form.args : undefined,
        env: Object.keys(form.env).length > 0 ? form.env : undefined,
        apiKey: form.apiKey || undefined,
        timeout: form.timeout,
        enabled: form.enabled,
        tools: form.tools.length > 0 ? form.tools : undefined,
      })
      ElMessage.success(t('mcp.messages.importSuccess', { count: 1 }))
    } else {
      await mcpServerApi.update(props.server!.id, {
        displayName: form.displayName || undefined,
        description: form.description || undefined,
        transport: form.transport,
        url: form.url || undefined,
        command: form.command || undefined,
        args: form.args.length > 0 ? form.args : undefined,
        env: Object.keys(form.env).length > 0 ? form.env : undefined,
        apiKey: clearApiKey.value ? null : form.apiKey || undefined,
        timeout: form.timeout,
        enabled: form.enabled,
        tools: form.tools.length > 0 ? form.tools : undefined,
      })
      ElMessage.success(t('mcp.messages.cacheRefreshed'))
    }
    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('保存失败:', error)
    ElMessage.error(error.response?.data?.message || t('mcp.messages.deleteFailed'))
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.form-tip {
  width: 100%;
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

.env-editor {
  width: 100%;

  .env-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

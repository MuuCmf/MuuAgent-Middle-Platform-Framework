<template>
  <div class="http-config-editor">
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px;">
      <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
        请勿将 URL 指向内网地址（如 127.0.0.1、10.x.x.x、172.16-31.x.x、192.168.x.x），
        避免服务端请求伪造（SSRF）攻击。建议仅允许 HTTPS 公网地址。
      </div>
    </el-alert>

    <div class="config-section">
      <div class="section-label">请求基本信息</div>
      
          <el-form-item label="请求方法">
            <el-select v-model="localConfig.method" class="w-full">
              <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
            </el-select>
          </el-form-item>
       
          <el-form-item label="请求 URL">
            <el-input v-model="localConfig.url" placeholder="https://api.example.com/users/:id" />
            <div class="field-tip">使用 :参数名 作为路径参数占位符，如 /users/:id</div>
          </el-form-item>
        
    </div>

    <div class="config-section">
      <div class="section-label">
        请求头 Headers
        <el-button size="small" type="primary" plain @click="addHeader">+ 添加</el-button>
      </div>
      <div v-if="headerList.length === 0" class="empty-hint">暂无自定义请求头</div>
      <div v-for="(item, index) in headerList" :key="index" class="kv-row">
        <el-input v-model="item.key" placeholder="Header 名称" class="kv-key" />
        <el-input v-model="item.value" placeholder="Header 值" class="kv-value" />
        <el-button type="danger" :icon="Delete" circle size="small" @click="removeHeader(index)" />
      </div>
    </div>

    <div class="config-section" v-if="showQueryParams">
      <div class="section-label">
        Query 参数
        <el-button size="small" type="primary" plain @click="addQueryParam">+ 添加</el-button>
      </div>
      <div v-if="queryParamList.length === 0" class="empty-hint">暂无 Query 参数</div>
      <div v-for="(item, index) in queryParamList" :key="index" class="kv-row">
        <el-input v-model="item.key" placeholder="参数名" class="kv-key" />
        <el-input v-model="item.value" placeholder="参数值（支持 {参数名} 占位符）" class="kv-value" />
        <el-button type="danger" :icon="Delete" circle size="small" @click="removeQueryParam(index)" />
      </div>
    </div>

    <div class="config-section" v-if="showBody">
      <div class="section-label">请求体 Body</div>
      <el-form-item label="Body 类型">
        <el-select v-model="localConfig.bodyType" class="w-full">
          <el-option label="JSON (application/json)" value="json" />
          <el-option label="表单 (application/x-www-form-urlencoded)" value="form" />
          <el-option label="纯文本 (text/plain)" value="text" />
        </el-select>
      </el-form-item>
      <el-form-item label="Body 内容">
        <el-input
          v-model="bodyText"
          type="textarea"
          :rows="6"
          :placeholder="bodyPlaceholder"
        />
        <div class="field-tip">使用 {参数名} 作为占位符，AI 调用时会自动替换</div>
      </el-form-item>
    </div>

    <div class="config-section">
      <div class="section-label">认证配置</div>
      <el-form-item label="认证方式">
        <el-select v-model="localConfig.auth.type" class="w-full">
          <el-option label="无认证" value="none" />
          <el-option label="Bearer Token" value="bearer" />
          <el-option label="Basic Auth" value="basic" />
          <el-option label="API Key" value="apikey" />
        </el-select>
      </el-form-item>
      <template v-if="localConfig.auth.type === 'bearer'">
        <el-form-item label="Token">
          <el-input v-model="localConfig.auth.token" placeholder="输入 Token 或 {{ENV:VAR_NAME}}" />
          <div class="field-tip">支持环境变量引用：<code v-text="'{{ENV:API_TOKEN}}'"></code></div>
        </el-form-item>
      </template>
      <template v-if="localConfig.auth.type === 'basic'">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="用户名">
              <el-input v-model="localConfig.auth.username" placeholder="用户名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="密码">
              <el-input v-model="localConfig.auth.password" type="password" show-password placeholder="密码" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>
      <template v-if="localConfig.auth.type === 'apikey'">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="Header 名">
              <el-input v-model="localConfig.auth.apiKeyHeader" placeholder="X-API-Key" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="API Key">
              <el-input v-model="localConfig.auth.apiKey" placeholder="输入 API Key 或 {{ENV:VAR_NAME}}" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>
    </div>

    <div class="config-section">
      <div class="section-label">测试请求</div>
      <el-form-item label="测试参数">
        <el-input
          v-model="testParamsText"
          type="textarea"
          :rows="3"
          placeholder='{"id": "123", "name": "test"}'
        />
        <div class="field-tip">输入 JSON 格式的测试参数</div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="testing" @click="handleTestRequest">
          <el-icon><Promotion /></el-icon>
          发送测试请求
        </el-button>
      </el-form-item>
      <div v-if="testResult" class="test-response">
        <div class="response-header">
          <span class="response-status" :class="statusClass">
            {{ testResult.status }} {{ testResult.statusText }}
          </span>
          <span class="response-time">{{ testResult.costMs }}ms</span>
        </div>
        <pre class="response-body">{{ formatJson(testResult.data) }}</pre>
      </div>
    </div>

    <div class="config-preview">
      <div class="preview-header">
        <span>配置预览</span>
        <el-button size="small" @click="copyConfig">复制配置</el-button>
      </div>
      <pre class="preview-code">{{ configPreview }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Promotion, WarningFilled } from '@element-plus/icons-vue'
import { testHttpRequest } from '@/api/skill'

interface HeaderItem {
  key: string
  value: string
}

interface QueryParamItem {
  key: string
  value: string
}

interface AuthConfig {
  type: string
  token: string
  username: string
  password: string
  apiKey: string
  apiKeyHeader: string
}

interface HttpSkillConfig {
  method: string
  url: string
  headers: HeaderItem[]
  queryParams: QueryParamItem[]
  body: Record<string, unknown>
  bodyType: string
  auth: AuthConfig
}

interface TestResult {
  status: number
  statusText: string
  headers: Record<string, unknown>
  data: unknown
  costMs: number
}

const props = defineProps<{
  config?: string
}>()

const emit = defineEmits<{
  (e: 'update:config', value: string): void
}>()

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const testing = ref(false)
const testResult = ref<TestResult | null>(null)
const testParamsText = ref('{}')

const defaultConfig: HttpSkillConfig = {
  method: 'GET',
  url: '',
  headers: [],
  queryParams: [],
  body: {},
  bodyType: 'json',
  auth: {
    type: 'none',
    token: '',
    username: '',
    password: '',
    apiKey: '',
    apiKeyHeader: 'X-API-Key',
  },
}

const localConfig = reactive<HttpSkillConfig>(JSON.parse(JSON.stringify(defaultConfig)))

const headerList = ref<HeaderItem[]>([])
const queryParamList = ref<QueryParamItem[]>([])

const showQueryParams = computed(() =>
  ['GET', 'HEAD', 'OPTIONS'].includes(localConfig.method.toUpperCase()),
)

const showBody = computed(() =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(localConfig.method.toUpperCase()),
)

const bodyPlaceholder = computed(() => {
  switch (localConfig.bodyType) {
    case 'json':
      return '{"name": "{name}", "age": {age}}'
    case 'form':
      return 'name={name}&age={age}'
    case 'text':
      return '纯文本内容，支持 {参数名} 占位符'
    default:
      return ''
  }
})

const bodyText = ref('')

const statusClass = computed(() => {
  if (!testResult.value) return ''
  const s = testResult.value.status
  if (s >= 200 && s < 300) return 'status-success'
  if (s >= 300 && s < 400) return 'status-redirect'
  if (s >= 400 && s < 500) return 'status-client-error'
  return 'status-server-error'
})

const configPreview = computed(() => {
  const config: Record<string, unknown> = {
    method: localConfig.method,
    url: localConfig.url,
  }

  const headers: Record<string, string> = {}
  for (const h of headerList.value) {
    if (h.key.trim()) {
      headers[h.key.trim()] = h.value
    }
  }
  if (Object.keys(headers).length > 0) {
    config.headers = headers
  }

  if (localConfig.auth.type === 'bearer' && localConfig.auth.token) {
    headers['Authorization'] = `Bearer ${localConfig.auth.token}`
  }
  if (localConfig.auth.type === 'basic' && localConfig.auth.username) {
    const cred = `${localConfig.auth.username}:${localConfig.auth.password}`
    headers['Authorization'] = `Basic ${btoa(cred)}`
  }
  if (localConfig.auth.type === 'apikey' && localConfig.auth.apiKey) {
    headers[localConfig.auth.apiKeyHeader || 'X-API-Key'] = localConfig.auth.apiKey
  }

  if (Object.keys(headers).length > 0) {
    config.headers = headers
  }

  if (queryParamList.value.length > 0) {
    const qp: Record<string, string> = {}
    for (const q of queryParamList.value) {
      if (q.key.trim()) {
        qp[q.key.trim()] = q.value
      }
    }
    if (Object.keys(qp).length > 0) {
      config.queryParams = qp
    }
  }

  if (showBody.value && bodyText.value.trim()) {
    config.bodyType = localConfig.bodyType
    if (localConfig.bodyType === 'json') {
      try {
        config.body = JSON.parse(bodyText.value)
      } catch {
        config.body = bodyText.value
      }
    } else {
      config.body = bodyText.value
    }
  }

  return JSON.stringify(config, null, 2)
})

const syncFromParent = (configStr: string) => {
  try {
    const parsed = JSON.parse(configStr || '{}')
    localConfig.method = parsed.method || 'GET'
    localConfig.url = parsed.url || ''
    localConfig.bodyType = parsed.bodyType || 'json'

    headerList.value = []
    if (parsed.headers) {
      for (const [key, value] of Object.entries(parsed.headers)) {
        const val = String(value)
        if (
          key.toLowerCase() === 'authorization' &&
          val.startsWith('Bearer ')
        ) {
          localConfig.auth.type = 'bearer'
          localConfig.auth.token = val.slice(7)
        } else if (
          key.toLowerCase() === 'authorization' &&
          val.startsWith('Basic ')
        ) {
          localConfig.auth.type = 'basic'
        } else {
          headerList.value.push({ key, value: val })
        }
      }
    }

    queryParamList.value = []
    if (parsed.queryParams) {
      for (const [key, value] of Object.entries(parsed.queryParams)) {
        queryParamList.value.push({ key, value: String(value) })
      }
    }

    if (parsed.body) {
      bodyText.value = typeof parsed.body === 'string'
        ? parsed.body
        : JSON.stringify(parsed.body, null, 2)
    } else {
      bodyText.value = ''
    }

    if (parsed.auth) {
      Object.assign(localConfig.auth, parsed.auth)
    }
  } catch {
    Object.assign(localConfig, JSON.parse(JSON.stringify(defaultConfig)))
    headerList.value = []
    queryParamList.value = []
    bodyText.value = ''
  }
}

const syncToParent = () => {
  emit('update:config', configPreview.value)
}

watch(() => props.config, (newVal) => {
  syncFromParent(newVal || '{}')
}, { immediate: true })

watch(
  [localConfig, headerList, queryParamList, bodyText],
  () => {
    syncToParent()
  },
  { deep: true },
)

const addHeader = () => {
  headerList.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  headerList.value.splice(index, 1)
}

const addQueryParam = () => {
  queryParamList.value.push({ key: '', value: '' })
}

const removeQueryParam = (index: number) => {
  queryParamList.value.splice(index, 1)
}

const handleTestRequest = async () => {
  testing.value = true
  testResult.value = null

  let testParams: Record<string, unknown> = {}
  try {
    testParams = JSON.parse(testParamsText.value || '{}')
  } catch {
    ElMessage.warning('测试参数 JSON 格式错误')
    testing.value = false
    return
  }

  try {
    const result = await testHttpRequest(configPreview.value, testParams)
    testResult.value = result
    if (result.status >= 200 && result.status < 300) {
      ElMessage.success(`请求成功: ${result.status} (${result.costMs}ms)`)
    } else {
      ElMessage.warning(`请求完成: ${result.status} (${result.costMs}ms)`)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '请求失败')
  } finally {
    testing.value = false
  }
}

const formatJson = (data: unknown): string => {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

const copyConfig = async () => {
  try {
    await navigator.clipboard.writeText(configPreview.value)
    ElMessage.success('配置已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style lang="scss" scoped>
.http-config-editor {
  width: 100%;
}

.config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #ebeef5;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.section-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #dcdfe6;
}

.w-full {
  width: 100%;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.empty-hint {
  font-size: 13px;
  color: #c0c4cc;
  text-align: center;
  padding: 12px 0;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  .kv-key {
    flex: 1;
    min-width: 120px;
  }

  .kv-value {
    flex: 2;
  }
}

.test-response {
  margin-top: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;

  .response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f5f7fa;
    border-bottom: 1px solid #dcdfe6;
  }

  .response-status {
    font-weight: 600;
    font-size: 14px;

    &.status-success {
      color: #67c23a;
    }

    &.status-redirect {
      color: #e6a23c;
    }

    &.status-client-error {
      color: #f56c6c;
    }

    &.status-server-error {
      color: #f56c6c;
    }
  }

  .response-time {
    font-size: 12px;
    color: #909399;
  }

  .response-body {
    margin: 0;
    padding: 12px;
    background: #fafafa;
    font-size: 12px;
    line-height: 1.6;
    max-height: 300px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.config-preview {
  margin-top: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f5f7fa;
    border-bottom: 1px solid #dcdfe6;
    font-weight: 500;
  }

  .preview-code {
    margin: 0;
    padding: 12px;
    background: #fafafa;
    font-size: 12px;
    line-height: 1.6;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
  }
}
</style>
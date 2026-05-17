<template>
  <el-drawer :model-value="visible" :title="editingSkill ? '编辑技能' : '添加技能'" direction="rtl" size="720px"
    class="skill-edit-drawer" @update:model-value="handleClose">
    <el-form :model="form" label-width="100px" class="skill-form">
      <div class="form-section">
        <div class="section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" required>
              <el-input v-model="form.name" placeholder="如：获取天气" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标识" required>
              <el-input v-model="form.code" placeholder="如：get_weather" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="所属应用" v-if="isSuperAdmin">
          <AppSelector v-model="form.appCode" placeholder="选择应用" clearable />
        </el-form-item>

        <el-form-item label="公开状态" v-if="isSuperAdmin">
          <el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有" />
          <div class="field-tip">公开的资源可被其他应用访问</div>
        </el-form-item>

        <el-form-item label="类型">
          <el-select v-model="form.type" class="w-full">
            <el-option label="HTTP请求 - 调用外部API" value="http" />
            <el-option label="函数技能 - 内置/插件/自定义" value="function" />
            <el-option label="数据库查询 - 执行SQL" value="database" />
            <el-option label="MCP工具 - 调用第三方MCP Server（高级）" value="mcp" />
            <el-option label="文件操作 - 上传/下载/处理" value="file" />
          </el-select>
          <div v-if="form.type === 'mcp'" class="field-tip field-tip-warning">
            ⚠️ 推荐通过<strong>智能体 → MCP Server 配置</strong>接入 MCP 工具，支持自动发现工具列表和参数 Schema。
            仅在需要<strong>自定义工具名称/描述</strong>或<strong>独立调用（不经过智能体对话）</strong>时使用此方式。
          </div>
        </el-form-item>

        <function-editor v-if="form.type === 'function'" v-model:code-type="form.codeType"
          v-model:plugin-name="form.pluginName" v-model:function-name="form.functionName"
          v-model:code-content="form.codeContent" />

        <el-form-item label="功能描述" required>
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="描述此技能的功能，AI会根据此描述决定是否调用" />
        </el-form-item>

        <el-form-item label="参数描述">
          <div class="params-wrapper">
            <el-input v-model="form.params" type="textarea" :rows="2" placeholder='描述参数格式，如：{"city": "城市名称，如：北京"}' />
            <div class="params-help">
              <el-collapse>
                <el-collapse-item title="📝 查看参数描述示例">
                  <div class="help-content">
                    <p class="help-title">参数描述格式说明：</p>
                    <ul class="help-list">
                      <li>使用 JSON 格式定义参数</li>
                      <li>key 为参数名，value 为参数说明</li>
                      <li>说明中可包含类型、示例值、是否必填等信息</li>
                    </ul>
                    <div class="help-examples">
                      <div class="example-item">
                        <span class="example-label">简单示例：</span>
                        <pre class="example-code">{"city": "城市名称"}</pre>
                      </div>
                      <div class="example-item">
                        <span class="example-label">详细示例：</span>
                        <pre class="example-code">{
  "city": {
    "type": "string",
    "description": "城市名称",
    "example": "北京",
    "required": true
  },
  "date": {
    "type": "string",
    "description": "日期，格式YYYY-MM-DD",
    "example": "2024-01-01",
    "required": false
  }
}</pre>
                      </div>
                    </div>
                    <p class="help-tip">💡 AI 会根据参数描述生成正确的调用参数</p>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">执行配置</div>
        
        <file-config-editor 
          v-if="form.type === 'file'" 
          v-model:config="form.config" 
        />
        
        <database-config-editor
          v-if="form.type === 'database'"
          v-model:config="form.config"
        />
        
        <http-config-editor
          v-if="form.type === 'http'"
          v-model:config="form.config"
        />
        
        <el-form-item label="配置内容" v-if="form.type !== 'file' && form.type !== 'database' && form.type !== 'http'">
          <div class="config-wrapper">
            <el-input v-model="form.config" type="textarea" :rows="6" placeholder="根据类型填写不同配置" />
            <div class="config-help">
              <el-collapse>
                <el-collapse-item title="📝 查看配置示例">
                  <div class="help-content">
                    <div v-if="form.type === 'http'" class="config-example">
                      <p class="help-title">HTTP请求配置示例：</p>
                      <pre class="example-code">{
  "method": "GET",
  "url": "https://api.example.com/weather",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  },
  "params": {
    "city": "{city}"
  }
}</pre>
                      <p class="help-tip">💡 使用 <code>{参数名}</code> 作为占位符，AI调用时会自动替换</p>
                    </div>
                    <div v-else-if="form.type === 'function'" class="config-example">
                      <p class="help-title">内置函数配置示例：</p>
                      <pre class="example-code">{
  "function": "getCurrentTime",
  "format": "YYYY-MM-DD HH:mm:ss",
  "timezone": "Asia/Shanghai"
}</pre>
                      <p class="help-tip">💡 可用函数：getCurrentTime、getRandomNumber、formatDate</p>
                    </div>
                    <div v-else-if="form.type === 'database'" class="config-example">
                      <p class="help-title">数据库查询配置示例：</p>
                      <pre class="example-code">{
  "connection": "mysql://user:pass@localhost/db",
  "query": "SELECT * FROM users WHERE city = '{city}'",
  "limit": 100
}</pre>
                      <p class="help-tip">💡 建议使用只读权限的数据库用户</p>
                    </div>
                    <div v-else-if="form.type === 'mcp'" class="config-example">
                      <p class="help-title">MCP工具配置示例：</p>
                      <pre class="example-code">{
  "url": "http://localhost:8080/mcp",
  "apiKey": "your-api-key",
  "toolName": "get_weather"
}</pre>
                      <div class="mcp-compare-notice">
                        <p class="notice-title">💡 与智能体 MCP Server 配置的区别：</p>
                        <table class="compare-table">
                          <thead>
                            <tr>
                              <th></th>
                              <th class="col-recommend">智能体 MCP Server ⭐推荐</th>
                              <th>Skill MCP（当前）</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>工具发现</td>
                              <td>自动发现所有工具</td>
                              <td>手动填写 toolName</td>
                            </tr>
                            <tr>
                              <td>参数 Schema</td>
                              <td>自动获取</td>
                              <td>手动填写</td>
                            </tr>
                            <tr>
                              <td>多工具管理</td>
                              <td>一个 Server 管理多个工具</td>
                              <td>一个 Skill 仅一个工具</td>
                            </tr>
                            <tr>
                              <td>适用场景</td>
                              <td>常规 MCP 工具接入</td>
                              <td>需自定义名称/描述或独立调用</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Skill, SkillForm } from '@/api/skill'
import { useUserStore } from '@/stores/user'
import FunctionEditor from './FunctionEditor.vue'
import FileConfigEditor from './FileConfigEditor.vue'
import DatabaseConfigEditor from './DatabaseConfigEditor.vue'
import HttpConfigEditor from './HttpConfigEditor.vue'
import AppSelector from '@/components/AppSelector.vue'

interface Props {
  visible: boolean
  skill?: Skill | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: SkillForm, callback: () => void): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  skill: null
})

const emit = defineEmits<Emits>()

const userStore = useUserStore()
const saving = ref(false)

const isSuperAdmin = computed(() => userStore.isSuperAdmin)

const form = ref<SkillForm & {
  codeType?: 'builtin' | 'plugin' | 'sandbox'
  pluginName?: string
  functionName?: string
  codeContent?: string
}>({
  name: '',
  code: '',
  type: 'http',
  description: '',
  params: '{}',
  config: '{}',
  status: true,
  timeout: 30000,
  codeType: 'builtin',
  pluginName: '',
  functionName: '',
  codeContent: '',
  appCode: '',
  isPublic: false,
})

const editingSkill = computed(() => props.skill)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (editingSkill.value) {
      form.value = {
        name: editingSkill.value.name || '',
        code: editingSkill.value.code || '',
        type: editingSkill.value.type || 'http',
        description: editingSkill.value.description || '',
        params: editingSkill.value.params || '{}',
        config: editingSkill.value.config || '{}',
        status: editingSkill.value.status ?? true,
        timeout: editingSkill.value.timeout ?? 30000,
        codeType: editingSkill.value.codeType || 'builtin',
        pluginName: editingSkill.value.pluginName || '',
        functionName: editingSkill.value.functionName || '',
        codeContent: editingSkill.value.codeContent || '',
        appCode: editingSkill.value.appCode || '',
        isPublic: editingSkill.value.isPublic ?? false,
      }
    } else {
      resetForm()
    }
  }
})

const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    type: 'http',
    description: '',
    params: '{}',
    config: '{}',
    status: true,
    timeout: 30000,
    codeType: 'builtin',
    pluginName: '',
    functionName: '',
    codeContent: '',
    appCode: '',
    isPublic: false,
  }
}

const handleClose = () => {
  emit('update:visible', false)
  resetForm()
}

const handleSave = () => {
  if (!form.value.name || !form.value.code || !form.value.description) {
    ElMessage.warning('请填写必填项')
    return
  }

  saving.value = true
  emit('save', form.value, () => {
    ElMessage.success(editingSkill.value ? '更新成功' : '创建成功')
    handleClose()
    saving.value = false
  })
}
</script>

<style lang="scss" scoped>
.skill-form {
  padding: 0 16px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;

  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}

.w-full {
  width: 100%;
}

.config-wrapper,
.params-wrapper {
  width: 100%;
}

.config-help,
.params-help {
  margin-top: 8px;

  :deep(.el-collapse) {
    border: none;
  }

  :deep(.el-collapse-item__header) {
    height: 32px;
    line-height: 32px;
    font-size: 13px;
    color: #409eff;
    background: transparent;
    border: none;

    &:hover {
      color: #66b1ff;
    }
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 0;
  }
}

.config-example {
  .example-code {
    background: #fff;
    padding: 10px 12px;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.6;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid #dcdfe6;
    color: #303133;
  }

  .help-tip {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: #909399;
    padding-top: 8px;
    border-top: 1px dashed #dcdfe6;

    code {
      padding: 1px 4px;
      background: #e9ecef;
      border-radius: 3px;
      color: #e6a23c;
    }
  }
}

.help-content {
  background: #f5f7fa;
  padding: 12px 16px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.help-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.help-list {
  margin: 0 0 12px 0;
  padding-left: 20px;
  font-size: 12px;
  color: #606266;
  line-height: 1.8;
}

.help-examples {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.example-item {
  .example-label {
    display: block;
    font-size: 12px;
    color: #909399;
    margin-bottom: 4px;
  }

  .example-code {
    background: #fff;
    padding: 10px 12px;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.6;
    overflow-x: auto;
    margin: 0;
    border: 1px solid #dcdfe6;
    color: #303133;
  }
}

.help-tip {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: #909399;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.field-tip {
  width: 100%;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.field-tip-warning {
  color: #e6a23c;
  background: #fdf6ec;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #faecd8;
  line-height: 1.6;
  margin-top: 8px;

  strong {
    color: #303133;
  }
}

.mcp-compare-notice {
  margin-top: 12px;
  padding: 12px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 4px;

  .notice-title {
    margin: 0 0 10px 0;
    font-size: 13px;
    font-weight: 500;
    color: #67c23a;
  }
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 6px 10px;
    border: 1px solid #e1f3d8;
    text-align: left;
  }

  th {
    background: #e1f3d8;
    color: #303133;
    font-weight: 500;
  }

  .col-recommend {
    color: #67c23a;
  }

  td {
    color: #606266;
    background: #fff;
  }

  td:first-child {
    font-weight: 500;
    color: #303133;
    background: #f5f7fa;
    white-space: nowrap;
  }
}
</style>

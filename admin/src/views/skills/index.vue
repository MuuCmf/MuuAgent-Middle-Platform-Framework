<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">🛠 技能管理</h1>
      <p class="page-description">管理智能体可调用的技能工具</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 技能管理说明</div>
      <ul>
        <li><strong>HTTP类型</strong>：调用外部HTTP API，如天气接口、查询服务等</li>
        <li><strong>函数类型</strong>：内置函数，如获取时间、随机数等</li>
        <li><strong>数据库类型</strong>：执行数据库查询（需配置连接）</li>
        <li><strong>MCP类型</strong>：调用第三方MCP Server提供的工具，支持Model Context Protocol协议</li>
        <li><strong>功能描述</strong>：给AI看的描述，AI根据描述决定是否调用此技能</li>
        <li><strong>参数描述</strong>：描述技能需要的参数格式，帮助AI正确传参</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">
        技能列表
        <el-tag type="info" size="small">{{ skills.length }} 个</el-tag>
      </div>
      
      <el-button type="primary" @click="handleAdd" style="margin-bottom: 16px;">
        <el-icon><Plus /></el-icon>
        添加技能
      </el-button>

      <el-table :data="skills" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="code" label="标识" width="180">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述">
          <template #default="{ row }">
            {{ row.description?.substring(0, 50) }}{{ row.description?.length > 50 ? '...' : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button size="small" @click="handleTest(row)">测试</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="editingSkill ? '编辑技能' : '添加技能'"
      direction="rtl"
      size="600px"
    >
      <el-form :model="form" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="技能名称" required>
              <el-input v-model="form.name" placeholder="如：获取天气" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="技能标识" required>
              <el-input v-model="form.code" placeholder="如：get_weather" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="技能类型">
          <el-select v-model="form.type" style="width: 100%;">
            <el-option label="HTTP请求 - 调用外部API" value="http" />
            <el-option label="内置函数 - 系统预设函数" value="function" />
            <el-option label="数据库查询 - 执行SQL" value="database" />
            <el-option label="MCP工具 - 调用第三方MCP Server" value="mcp" />
          </el-select>
        </el-form-item>

        <el-form-item label="功能描述" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="描述此技能的功能，AI会根据此描述决定是否调用"
          />
        </el-form-item>

        <el-form-item label="参数描述">
          <el-input
            v-model="form.params"
            type="textarea"
            :rows="2"
            placeholder='描述参数格式，如：{"city": "城市名称，如：北京"}'
          />
        </el-form-item>

        <el-form-item label="执行配置">
          <el-input
            v-model="form.config"
            type="textarea"
            :rows="5"
            placeholder="根据类型填写不同配置"
          />
          <div class="config-help">
            <el-alert type="info" :closable="false" style="margin-top: 8px;">
              <template #title>
                <strong>📝 配置说明</strong>
              </template>
              <div v-if="form.type === 'http'" class="config-example">
                <p><strong>HTTP请求配置示例：</strong></p>
                <pre class="code-example">{
  "method": "GET",
  "url": "https://api.example.com/weather",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  },
  "params": {
    "city": "{city}"
  }
}</pre>
                <p style="margin-top: 8px; color: #666; font-size: 12px;">
                  💡 提示：使用双花括号包裹参数名作为占位符，如：city 参数写成 "city": "{参数名}"，AI调用时会自动替换
                </p>
              </div>
              <div v-else-if="form.type === 'function'" class="config-example">
                <p><strong>内置函数配置示例：</strong></p>
                <pre class="code-example">{
  "function": "getCurrentTime",
  "format": "YYYY-MM-DD HH:mm:ss",
  "timezone": "Asia/Shanghai"
}</pre>
                <p style="margin-top: 8px; color: #666; font-size: 12px;">
                  💡 可用函数：getCurrentTime（获取当前时间）、getRandomNumber（获取随机数）、formatDate（格式化日期）
                </p>
              </div>
              <div v-else-if="form.type === 'database'" class="config-example">
                <p><strong>数据库查询配置示例：</strong></p>
                <pre class="code-example">{
  "connection": "mysql://user:pass@localhost/db",
  "query": "SELECT * FROM users WHERE city = '{city}'",
  "limit": 100
}</pre>
                <p style="margin-top: 8px; color: #666; font-size: 12px;">
                  💡 提示：数据库查询需要配置连接信息，建议使用只读权限的数据库用户
                </p>
              </div>
              <div v-else-if="form.type === 'mcp'" class="config-example">
                <p><strong>MCP工具配置示例：</strong></p>
                <pre class="code-example">{
  "url": "http://localhost:8080/mcp",
  "apiKey": "your-api-key",
  "toolName": "get_weather"
}</pre>
                <p style="margin-top: 8px; color: #666; font-size: 12px;">
                  💡 配置说明：
                </p>
                <ul style="margin: 4px 0; padding-left: 20px; color: #666; font-size: 12px;">
                  <li><strong>url</strong>：MCP Server 的 HTTP 端点地址</li>
                  <li><strong>apiKey</strong>：API密钥（可选，如果MCP Server需要认证）</li>
                  <li><strong>toolName</strong>：要调用的工具名称</li>
                </ul>
                <p style="margin-top: 8px; color: #409eff; font-size: 12px;">
                  🔗 MCP (Model Context Protocol) 是 Anthropic 推出的开放协议，支持连接各种外部工具和数据源
                </p>
              </div>
            </el-alert>
          </div>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.status" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div style="text-align: right;">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 测试技能弹窗 -->
    <el-dialog
      v-model="testDialogVisible"
      title="🧪 测试技能"
      width="600px"
    >
      <div class="test-dialog-content">
        <div class="test-skill-info">
          <p><strong>技能名称：</strong>{{ testingSkill?.name }}</p>
          <p><strong>技能标识：</strong><el-tag type="info" size="small">{{ testingSkill?.code }}</el-tag></p>
          <p><strong>技能类型：</strong><el-tag size="small">{{ testingSkill?.type }}</el-tag></p>
          <p><strong>功能描述：</strong>{{ testingSkill?.description }}</p>
        </div>

        <el-divider />

        <el-form label-width="80px">
          <el-form-item label="测试参数">
            <el-input
              v-model="testParams"
              type="textarea"
              :rows="5"
              placeholder='请输入JSON格式的参数，如：{"city": "北京"}'
            />
            <div class="test-params-help">
              <el-alert type="info" :closable="false" style="margin-top: 8px;">
                <template #title>
                  <strong>📝 参数说明</strong>
                </template>
                <div v-if="testingSkill?.params">
                  <p style="margin: 0;">该技能定义的参数格式：</p>
                  <pre class="params-example">{{ testingSkill.params }}</pre>
                </div>
                <div v-else>
                  <p style="margin: 0; color: #999;">该技能无需参数</p>
                </div>
              </el-alert>
            </div>
          </el-form-item>
        </el-form>

        <el-divider />

        <div v-if="testResult" class="test-result">
          <p><strong>执行结果：</strong></p>
          <pre class="result-content" :class="{ 'is-error': testError }">{{ testResult }}</pre>
        </div>
      </div>

      <template #footer>
        <div style="text-align: right;">
          <el-button @click="testDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="executeTest" :loading="testLoading">
            执行测试
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useSkillStore } from '@/stores/skill'
import { skillApi } from '@/api/skill'
import type { Skill, SkillForm } from '@/api/skill'

const skillStore = useSkillStore()

const { skills, loading, loadSkills, createSkill, updateSkill, deleteSkill } = skillStore

const drawerVisible = ref(false)
const editingSkill = ref<Skill | null>(null)
const form = ref<SkillForm>({
  name: '',
  code: '',
  type: 'http',
  description: '',
  params: '{}',
  config: '{}',
  status: true
})

// 测试相关
const testDialogVisible = ref(false)
const testingSkill = ref<Skill | null>(null)
const testParams = ref('{}')
const testResult = ref('')
const testError = ref(false)
const testLoading = ref(false)

const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    type: 'http',
    description: '',
    params: '{}',
    config: '{}',
    status: true
  }
  editingSkill.value = null
}

const handleAdd = () => {
  resetForm()
  drawerVisible.value = true
}

const handleEdit = (skill: Skill) => {
  editingSkill.value = skill
  form.value = { ...skill }
  drawerVisible.value = true
}

const handleSave = async () => {
  if (!form.value.name || !form.value.code || !form.value.description) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    if (editingSkill.value) {
      await updateSkill(editingSkill.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createSkill(form.value)
      ElMessage.success('创建成功')
    }
    drawerVisible.value = false
  } catch (error) {
    console.error('保存失败', error)
  }
}

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除该技能？', '提示', {
      type: 'warning'
    })
    await deleteSkill(id)
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败', error)
  }
}

/**
 * 打开测试弹窗
 */
const handleTest = (skill: Skill) => {
  testingSkill.value = skill
  testParams.value = skill.params || '{}'
  testResult.value = ''
  testError.value = false
  testDialogVisible.value = true
}

/**
 * 执行技能测试
 */
const executeTest = async () => {
  if (!testingSkill.value) return
  
  let params = {}
  try {
    params = JSON.parse(testParams.value)
  } catch {
    ElMessage.error('参数格式错误，请输入有效的JSON')
    return
  }

  testLoading.value = true
  testResult.value = ''
  testError.value = false

  try {
    const res = await skillApi.execute(testingSkill.value.code, params)
    testResult.value = JSON.stringify(res.data?.data || res.data, null, 2)
    ElMessage.success('执行成功')
  } catch (error: any) {
    testError.value = true
    testResult.value = error.response?.data?.message || error.message || '执行失败'
    ElMessage.error('执行失败')
  } finally {
    testLoading.value = false
  }
}

onMounted(() => {
  loadSkills()
})
</script>

<style lang="scss" scoped>
.config-help {
  margin-top: 8px;
}

.config-example {
  p {
    margin: 0 0 8px 0;
    
    &:first-child {
      margin-top: 0;
    }
  }
}

.code-example {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid #e4e7ed;
  
  code {
    background: #fff;
    padding: 2px 6px;
    border-radius: 3px;
    color: #409eff;
    font-family: 'Courier New', Courier, monospace;
  }
}

.test-dialog-content {
  .test-skill-info {
    p {
      margin: 8px 0;
      line-height: 1.6;
    }
  }

  .test-params-help {
    .params-example {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      margin-top: 8px;
      overflow-x: auto;
    }
  }

  .test-result {
    .result-content {
      background: #f0f9eb;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e1f3d8;

      &.is-error {
        background: #fef0f0;
        border-color: #fde2e2;
        color: #f56c6c;
      }
    }
  }
}
</style>

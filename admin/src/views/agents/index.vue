<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">🤖 智能体</h1>
      <p class="page-description">创建和管理具有特定能力的AI助手</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 智能体说明</div>
      <ul>
        <li><strong>智能体</strong>：具有特定能力的AI助手，可以自动调用技能完成任务</li>
        <li><strong>系统提示词</strong>：定义智能体的角色和行为方式</li>
        <li><strong>绑定技能</strong>：智能体可以调用的技能列表，以JSON数组格式填写</li>
        <li><strong>MCP Server</strong>：Model Context Protocol Server，提供外部工具和数据源</li>
        <li><strong>最大执行步数</strong>：限制智能体最多执行多少步操作</li>
        <li><strong>温度参数</strong>：控制输出随机性，0-1之间，值越大越随机</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">
        智能体列表
        <el-tag type="info" size="small">{{ agents.length }} 个</el-tag>
      </div>
      
      <el-button type="primary" @click="handleAdd" style="margin-bottom: 16px;">
        <el-icon><Plus /></el-icon>
        创建智能体
      </el-button>

      <el-table :data="agents" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="code" label="标识" width="180">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skills" label="绑定技能" width="200">
          <template #default="{ row }">
            <template v-if="parseJsonSafe(row.skills).length">
              <el-tag
                v-for="s in parseJsonSafe(row.skills)"
                :key="s"
                type="info"
                size="small"
                style="margin-right: 4px"
              >
                {{ s }}
              </el-tag>
            </template>
            <span v-else style="color: #999">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="mcpServers" label="MCP Server" width="200">
          <template #default="{ row }">
            <template v-if="parseJsonSafe(row.mcpServers).length">
              <el-tag
                v-for="server in parseJsonSafe(row.mcpServers)"
                :key="server.name"
                type="success"
                size="small"
                style="margin-right: 4px"
              >
                {{ server.name }}
              </el-tag>
            </template>
            <span v-else style="color: #999">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="editingAgent ? '编辑智能体' : '创建智能体'"
      direction="rtl"
      size="600px"
    >
      <el-form :model="form" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="智能体名称" required>
              <el-input v-model="form.name" placeholder="如：天气助手" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="智能体标识" required>
              <el-input v-model="form.code" placeholder="如：weather_assistant" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="系统提示词" required>
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="5"
            placeholder="定义智能体的角色和行为方式"
          />
        </el-form-item>

        <el-form-item label="绑定技能">
          <el-input
            v-model="form.skills"
            placeholder='["get_weather", "get_time"]'
          />
          <div class="skill-help">
            <el-alert type="info" :closable="false" style="margin-top: 8px;">
              <template #title>
                <strong>📝 技能绑定说明</strong>
              </template>
              <div class="skill-example">
                <p><strong>格式要求：</strong></p>
                <p style="margin: 8px 0; color: #666; font-size: 13px;">
                  使用JSON数组格式填写技能标识，每个技能标识用双引号包裹，多个技能用逗号分隔
                </p>
                
                <p style="margin-top: 12px;"><strong>示例：</strong></p>
                <pre class="code-example">["get_weather", "get_time", "send_email"]</pre>
                
                <p style="margin-top: 12px;"><strong>可用技能列表：</strong></p>
                <div v-if="skills.length > 0" style="margin-top: 8px;">
                  <el-tag
                    v-for="s in skills"
                    :key="s.code"
                    size="small"
                    style="margin: 4px; cursor: pointer;"
                    @click="addSkillToForm(s.code)"
                  >
                    {{ s.code }}
                  </el-tag>
                  <p style="margin-top: 8px; color: #999; font-size: 12px;">
                    💡 点击技能标签可快速添加
                  </p>
                </div>
                <div v-else style="color: #999; font-size: 12px; margin-top: 8px;">
                  暂无可用技能，请先在技能管理中创建
                </div>
                
                <p style="margin-top: 12px; color: #666; font-size: 12px;">
                  💡 提示：智能体会根据用户问题自动判断是否需要调用绑定的技能
                </p>
              </div>
            </el-alert>
          </div>
        </el-form-item>

        <el-divider>
          <el-icon><Connection /></el-icon>
          MCP Server 绑定
        </el-divider>

        <el-form-item label="">
          <div style="width: 100%;">
            <el-button type="primary" @click="handleAddMcpServer" style="margin-bottom: 12px;">
              <el-icon><Plus /></el-icon>
              添加 MCP Server
            </el-button>

            <div v-if="mcpServers.length === 0" class="no-mcp-servers">
              <el-empty description="暂未绑定 MCP Server" :image-size="80" />
            </div>

            <div v-else>
              <McpServerCard
                v-for="(config, index) in mcpServers"
                :key="index"
                :config="config"
                @delete="handleDeleteMcpServer(index)"
                @edit="handleEditMcpServer(index)"
              />
            </div>

            <el-alert type="info" :closable="false" style="margin-top: 12px;">
              <template #title>
                <strong>💡 MCP Server 说明</strong>
              </template>
              <div style="font-size: 13px; line-height: 1.6;">
                <p><strong>MCP Server</strong>：Model Context Protocol Server，提供外部工具和数据源</p>
                <p style="margin-top: 8px;"><strong>工具命名规范：</strong></p>
                <ul style="margin: 8px 0; padding-left: 20px;">
                  <li>技能工具：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">{skillCode}</code></li>
                  <li>MCP工具：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">mcp:{serverName}:{toolName}</code></li>
                </ul>
                <p style="margin-top: 8px; color: #666;">
                  示例：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">mcp:filesystem:read_file</code>
                </p>
              </div>
            </el-alert>
          </div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大执行步数">
              <el-input-number v-model="form.maxSteps" :min="1" :max="20" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="温度参数">
              <el-input-number v-model="form.temperature" :min="0" :max="1" :step="0.1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

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

    <McpServerConfigDialog
      v-model="mcpServerDialogVisible"
      :config="editingMcpServerIndex !== null ? mcpServers[editingMcpServerIndex] : null"
      @save="handleMcpServerSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Connection } from '@element-plus/icons-vue'
import { useAgentStore, useSkillStore } from '@/stores'
import type { Agent, AgentForm } from '@/api/agent'
import type { McpServerConfig } from '@/api/mcp-server'
import McpServerConfigDialog from '@/components/McpServerConfigDialog.vue'
import McpServerCard from '@/components/McpServerCard.vue'

const agentStore = useAgentStore()
const skillStore = useSkillStore()

const { agents, loading, loadAgents, createAgent, updateAgent, deleteAgent } = agentStore
const { skills, loadSkills } = skillStore

const drawerVisible = ref(false)
const editingAgent = ref<Agent | null>(null)
const form = ref<AgentForm>({
  name: '',
  code: '',
  systemPrompt: '',
  skills: '[]',
  mcpServers: '[]',
  maxSteps: 5,
  temperature: 0.7,
  status: true
})

const mcpServerDialogVisible = ref(false)
const editingMcpServerIndex = ref<number | null>(null)
const mcpServers = ref<McpServerConfig[]>([])

const parseJsonSafe = (str: string, defaultValue: any[] = []) => {
  if (!str) return defaultValue
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    systemPrompt: '',
    skills: '[]',
    mcpServers: '[]',
    maxSteps: 5,
    temperature: 0.7,
    status: true
  }
  editingAgent.value = null
  mcpServers.value = []
}

const handleAdd = () => {
  resetForm()
  drawerVisible.value = true
}

const handleEdit = (agent: Agent) => {
  editingAgent.value = agent
  form.value = {
    ...agent,
    skills: Array.isArray(agent.skills) ? JSON.stringify(agent.skills) : agent.skills,
    mcpServers: agent.mcpServers || '[]'
  }
  mcpServers.value = parseJsonSafe(agent.mcpServers || '[]')
  drawerVisible.value = true
}

const addSkillToForm = (skillCode: string) => {
  try {
    const currentSkills = JSON.parse(form.value.skills || '[]')
    if (!currentSkills.includes(skillCode)) {
      currentSkills.push(skillCode)
      form.value.skills = JSON.stringify(currentSkills)
      ElMessage.success(`已添加技能: ${skillCode}`)
    } else {
      ElMessage.warning(`技能 ${skillCode} 已存在`)
    }
  } catch {
    form.value.skills = JSON.stringify([skillCode])
    ElMessage.success(`已添加技能: ${skillCode}`)
  }
}

const handleAddMcpServer = () => {
  editingMcpServerIndex.value = null
  mcpServerDialogVisible.value = true
}

const handleEditMcpServer = (index: number) => {
  editingMcpServerIndex.value = index
  mcpServerDialogVisible.value = true
}

const handleDeleteMcpServer = (index: number) => {
  mcpServers.value.splice(index, 1)
  ElMessage.success('已删除 MCP Server')
}

const handleMcpServerSave = (config: McpServerConfig) => {
  if (editingMcpServerIndex.value !== null) {
    mcpServers.value[editingMcpServerIndex.value] = config
    ElMessage.success('MCP Server 配置已更新')
  } else {
    mcpServers.value.push(config)
    ElMessage.success('MCP Server 已添加')
  }
}

const handleSave = async () => {
  if (!form.value.name || !form.value.code || !form.value.systemPrompt) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    JSON.parse(form.value.skills)
  } catch {
    ElMessage.warning('技能列表格式错误，请使用JSON数组格式')
    return
  }

  form.value.mcpServers = JSON.stringify(mcpServers.value)

  try {
    if (editingAgent.value) {
      await updateAgent(editingAgent.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createAgent(form.value)
      ElMessage.success('创建成功')
    }
    drawerVisible.value = false
  } catch (error) {
    console.error('保存失败', error)
  }
}

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除该智能体？', '提示', {
      type: 'warning'
    })
    await deleteAgent(id)
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => {
  loadAgents()
  loadSkills()
})
</script>

<style lang="scss" scoped>
.skill-help {
  margin-top: 8px;
}

.skill-example {
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
}

.no-mcp-servers {
  padding: 20px;
  text-align: center;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>

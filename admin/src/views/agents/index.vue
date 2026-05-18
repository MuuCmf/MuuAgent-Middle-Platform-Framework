<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">智能体</h1>
      <p class="page-description">创建和管理具有特定能力的AI助手</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>智能体列表</span>
        <el-tag type="info" size="small">{{ agents.length }} 个</el-tag>
        <AppSelector
          v-if="isSuperAdmin"
          v-model="filterAppCode"
          placeholder="筛选应用"
          style="margin-left: 16px;"
          @change="handleAppFilterChange"
        />
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

      <el-button type="primary" @click="handleAdd" style="margin-bottom: 16px;">
        <el-icon>
          <Plus />
        </el-icon>
        创建智能体
      </el-button>

      <el-table :data="agents" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="code" label="标识" width="150">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" label="所属应用" width="120" v-if="isSuperAdmin">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" type="warning" size="small">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999">全局</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" label="公开状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? '公开' : '私有' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skills" label="绑定技能" width="180">
          <template #default="{ row }">
            <template v-if="parseJsonSafe(row.skills).length">
              <el-tag v-for="s in parseJsonSafe(row.skills).slice(0, 2)" :key="s" type="info" size="small"
                style="margin-right: 4px">
                {{ s }}
              </el-tag>
              <el-tag v-if="parseJsonSafe(row.skills).length > 2" type="info" size="small">
                +{{ parseJsonSafe(row.skills).length - 2 }}
              </el-tag>
            </template>
            <span v-else style="color: #999">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="reasoningMode" label="推理模式" width="100">
          <template #default="{ row }">
            <el-tag :type="getReasoningTagType(row.reasoningMode)" size="small">
              {{ getReasoningLabel(row.reasoningMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="工作目录" width="90">
          <template #default="{ row }">
            <el-tag
              :type="isWorkspaceEnabled(row) ? 'success' : 'info'"
              size="small"
            >
              {{ isWorkspaceEnabled(row) ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AgentEditDrawer v-model:visible="drawerVisible" :agent="editingAgent" :available-skills="skills"
      @save="handleSave" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAgentStore, useSkillStore, useUserStore } from '@/stores'
import type { Agent, AgentForm } from '@/api/agent'
import AgentEditDrawer from './components/AgentEditDrawer.vue'
import AppSelector from '@/components/AppSelector.vue'

const agentStore = useAgentStore()
const skillStore = useSkillStore()
const userStore = useUserStore()

const agents = computed(() => agentStore.agents)
const loading = computed(() => agentStore.loading)
const { loadAgents, createAgent, updateAgent, deleteAgent } = agentStore
const skills = computed(() => skillStore.standardSkills)
const { loadStandardSkills } = skillStore

const isSuperAdmin = computed(() => userStore.isSuperAdmin)
const filterAppCode = ref('')
const drawerVisible = ref(false)
const editingAgent = ref<Agent | null>(null)

const parseJsonSafe = (str: string, defaultValue: any[] = []) => {
  if (!str) return defaultValue
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

const getReasoningLabel = (mode: string) => {
  const labels: Record<string, string> = {
    NONE: '默认',
    REACT: 'ReAct',
    PLAN: 'Plan',
    REFLECT: 'Reflect',
  }
  return labels[mode] || '默认'
}

const getReasoningTagType = (mode: string) => {
  const types: Record<string, string> = {
    NONE: 'info',
    REACT: 'success',
    PLAN: 'warning',
    REFLECT: 'danger',
  }
  return types[mode] || 'info'
}

const isWorkspaceEnabled = (agent: Agent) => {
  try {
    const config = typeof agent.workspaceConfig === 'string'
      ? JSON.parse(agent.workspaceConfig)
      : agent.workspaceConfig
    return config?.enabled === true
  } catch {
    return false
  }
}

const handleAppFilterChange = () => {
  loadAgents()
}

const handleAdd = () => {
  editingAgent.value = null
  drawerVisible.value = true
}

const handleEdit = (agent: Agent) => {
  editingAgent.value = agent
  drawerVisible.value = true
}

const handleSave = async (data: AgentForm) => {
  try {
    if (editingAgent.value) {
      await updateAgent(editingAgent.value.id, data)
    } else {
      await createAgent(data)
    }
  } catch (error) {
    console.error('保存失败', error)
    throw error
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
  loadStandardSkills()
})
</script>

<style lang="scss" scoped>
.card-title {
  display: flex;
  align-items: center;
}
</style>

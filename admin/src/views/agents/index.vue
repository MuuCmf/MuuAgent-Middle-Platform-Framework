<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('agent.title') }}</h1>
      <p class="page-description">{{ $t('agent.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 {{ $t('agent.agentExplanation') }}</div>
      <ul>
        <li>{{ $t('agent.agentDesc') }}</li>
        <li>{{ $t('agent.systemPromptDesc') }}</li>
        <li>{{ $t('agent.bindSkillsDesc') }}</li>
        <li>{{ $t('agent.skillDependencyDesc') }}</li>
        <li>{{ $t('agent.maxStepsDesc') }}</li>
        <li>{{ $t('agent.reasoningModeDesc') }}</li>
      </ul>
    </div>

    <div class="card">
      <el-button type="primary" @click="handleAdd" style="margin-bottom: 16px;">
        <el-icon>
          <Plus />
        </el-icon>
        {{ $t('agent.createAgent') }}
      </el-button>

      <el-table :data="agents" stripe v-loading="loading">
        <el-table-column prop="name" :label="$t('agent.agentName')" min-width="120" />
        <el-table-column prop="code" :label="$t('agent.agentCode')" width="150">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" :label="$t('agent.belongApp')" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" type="warning" size="small">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999">{{ $t('agent.global') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" :label="$t('agent.publicStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? $t('agent.public') : $t('agent.private') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skills" :label="$t('agent.bindSkills')" width="180">
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
            <span v-else style="color: #999">{{ $t('agent.noSkills') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reasoningMode" :label="$t('agent.reasoningMode')" width="100">
          <template #default="{ row }">
            <el-tag :type="getReasoningTagType(row.reasoningMode)" size="small">
              {{ getReasoningLabel(row.reasoningMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('agent.workspace')" width="90">
          <template #default="{ row }">
            <el-tag :type="isWorkspaceEnabled(row) ? 'success' : 'info'" size="small">
              {{ isWorkspaceEnabled(row) ? $t('agent.workspaceEnabled') : $t('agent.workspaceDisabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="$t('common.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? $t('common.enable') : $t('common.disable') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions')" width="150" align="right" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">{{ $t('common.edit') }}</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">{{ $t('common.delete') }}</el-button>
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
import { useAgentStore, useSkillStore } from '@/stores'
import type { Agent, AgentForm } from '@/api/agent'
import AgentEditDrawer from './components/AgentEditDrawer.vue'
import AppSelector from '@/components/AppSelector.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const agentStore = useAgentStore()
const skillStore = useSkillStore()

const agents = computed(() => agentStore.agents)
const loading = computed(() => agentStore.loading)
const { loadAgents, createAgent, updateAgent, deleteAgent } = agentStore
const skills = computed(() => skillStore.standardSkills)
const { loadStandardSkills } = skillStore

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
    NONE: t('agent.defaultMode'),
    REACT: t('agent.reactMode'),
    PLAN: t('agent.planMode'),
    REFLECT: t('agent.reflectMode'),
  }
  return labels[mode] || t('agent.defaultMode')
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
    await ElMessageBox.confirm(t('agent.confirmDelete'), t('common.tip'), {
      type: 'warning'
    })
    await deleteAgent(id)
    ElMessage.success(t('agent.deleteSuccess'))
  } catch (error) {
    console.error(t('agent.deleteFailed'), error)
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

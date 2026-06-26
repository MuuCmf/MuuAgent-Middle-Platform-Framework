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
      <!-- 搜索筛选区域 -->
      <div class="search-filter-area" style="margin-bottom: 16px;">
        <el-input
          v-model="searchForm.name"
          :placeholder="$t('agent.searchName')"
          clearable
          style="width: 200px; margin-right: 8px;"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="searchForm.code"
          :placeholder="$t('agent.searchCode')"
          clearable
          style="width: 200px; margin-right: 8px;"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          :placeholder="$t('common.status')"
          clearable
          style="width: 120px; margin-right: 8px;"
          @change="handleSearch"
        >
          <el-option :label="$t('common.enable')" :value="true" />
          <el-option :label="$t('common.disable')" :value="false" />
        </el-select>
        <el-select
          v-model="searchForm.reasoningMode"
          :placeholder="$t('agent.reasoningMode')"
          clearable
          style="width: 120px; margin-right: 8px;"
          @change="handleSearch"
        >
          <el-option :label="$t('agent.defaultMode')" value="NONE" />
          <el-option :label="$t('agent.reactMode')" value="REACT" />
          <el-option :label="$t('agent.planMode')" value="PLAN" />
          <el-option :label="$t('agent.reflectMode')" value="REFLECT" />
        </el-select>
        <el-select
          v-model="searchForm.isPublic"
          :placeholder="$t('agent.publicStatus')"
          clearable
          style="width: 120px; margin-right: 8px;"
          @change="handleSearch"
        >
          <el-option :label="$t('agent.public')" :value="true" />
          <el-option :label="$t('agent.private')" :value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          {{ $t('common.search') }}
        </el-button>
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          {{ $t('common.reset') }}
        </el-button>
        <el-button type="primary" @click="handleAdd" style="float: right;">
          <el-icon>
            <Plus />
          </el-icon>
          {{ $t('agent.createAgent') }}
        </el-button>
      </div>

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
        <el-table-column prop="sort" :label="$t('agent.sort')" width="80" />
        <el-table-column prop="status" :label="$t('common.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? $t('common.enable') : $t('common.disable') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions')" width="150" align="right" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="handleEdit(row)">{{ $t('common.edit') }}</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row.id)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页器 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        style="margin-top: 16px; justify-content: flex-end;"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <AgentEditDrawer v-model:visible="drawerVisible" :agent="editingAgent" :available-skills="skills"
      @save="handleSave" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { useAgentStore, useSkillStore } from '@/stores'
import type { Agent, AgentForm, AgentQueryParams } from '@/api/agent'
import AgentEditDrawer from './components/AgentEditDrawer.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const agentStore = useAgentStore()
const skillStore = useSkillStore()

const agents = computed(() => agentStore.agents)
const loading = computed(() => agentStore.loading)
const total = computed(() => agentStore.total)
const currentPage = computed({
  get: () => agentStore.page,
  set: (val) => agentStore.page = val
})
const currentPageSize = computed({
  get: () => agentStore.pageSize,
  set: (val) => agentStore.pageSize = val
})

const { loadAgents, searchAgents, resetAndLoad, changePage, changePageSize, createAgent, updateAgent, deleteAgent } = agentStore
const skills = computed(() => skillStore.standardSkills)
const { loadStandardSkills } = skillStore

const drawerVisible = ref(false)
const editingAgent = ref<Agent | null>(null)

// 搜索表单
const searchForm = ref<AgentQueryParams>({
  name: '',
  code: '',
  status: undefined,
  reasoningMode: undefined,
  isPublic: undefined
})

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

/**
 * 搜索智能体
 */
const handleSearch = () => {
  searchAgents(searchForm.value)
}

/**
 * 重置搜索条件
 */
const handleReset = () => {
  searchForm.value = {
    name: '',
    code: '',
    status: undefined,
    reasoningMode: undefined,
    isPublic: undefined
  }
  resetAndLoad()
}

/**
 * 页码改变
 * @param page 新页码
 */
const handleCurrentChange = (page: number) => {
  changePage(page)
}

/**
 * 每页数量改变
 * @param size 新的每页数量
 */
const handleSizeChange = (size: number) => {
  changePageSize(size)
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

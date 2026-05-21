<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('prompt.title') }}</h1>
      <p class="page-description">{{ $t('prompt.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ $t('prompt.helpTip.title') }}</div>
      <ul>
        <li><strong>{{ $t('prompt.list.code') }}</strong>：{{ $t('prompt.helpTip.identifier') }}</li>
        <li><strong>{{ $t('prompt.list.category') }}</strong>：{{ $t('prompt.helpTip.category') }}</li>
        <li><strong>{{ $t('prompt.variables.title') }}</strong>：{{ $t('prompt.helpTip.variable') }}</li>
        <li><strong>{{ $t('prompt.list.version') }}</strong>：{{ $t('prompt.helpTip.version') }}</li>
        <li><strong>{{ $t('prompt.form.defaultTemplate') }}</strong>：{{ $t('prompt.helpTip.defaultTemplate') }}</li>
      </ul>
    </div>

    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon>
            <Plus />
          </el-icon>
          {{ $t('prompt.actions.add') }}
        </el-button>

        <div class="filters">
          <el-select v-model="filters.category" :placeholder="$t('prompt.filter.categoryPlaceholder')" clearable
            @change="handleFilter" style="width: 150px; margin-right: 12px;">
            <el-option :label="$t('prompt.categories.agent')" value="agent" />
            <el-option :label="$t('prompt.categories.rag')" value="rag" />
            <el-option :label="$t('prompt.categories.react')" value="react" />
            <el-option :label="$t('prompt.categories.skill')" value="skill" />
            <el-option :label="$t('prompt.categories.custom')" value="custom" />
          </el-select>

          <el-select v-model="filters.status" :placeholder="$t('prompt.filter.statusPlaceholder')" clearable
            @change="handleFilter" style="width: 120px; margin-right: 12px;">
            <el-option :label="$t('prompt.filter.enabled')" :value="true" />
            <el-option :label="$t('prompt.filter.disabled')" :value="false" />
          </el-select>

          <el-input v-model="filters.keyword" :placeholder="$t('prompt.filter.searchPlaceholder')" clearable
            @change="handleFilter" style="width: 250px;">
            <template #prefix>
              <el-icon>
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-table :data="templates" stripe v-loading="loading">
        <el-table-column prop="name" :label="$t('prompt.list.name')" width="150" />
        <el-table-column prop="code" :label="$t('prompt.list.code')" width="150">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" :label="$t('prompt.list.category')" width="90">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)" size="small">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" :label="$t('prompt.list.appCode')" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" type="warning" size="small">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999">{{ $t('prompt.list.global') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" :label="$t('prompt.list.visibility')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? $t('prompt.list.public') : $t('prompt.list.private') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="$t('prompt.list.description')" min-width="150"
          show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || $t('prompt.list.noDescription') }}
          </template>
        </el-table-column>
        <el-table-column prop="version" :label="$t('prompt.list.version')" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small">v{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isDefault" :label="$t('prompt.list.isDefault')" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" size="small">{{ $t('prompt.list.yes') }}</el-tag>
            <span v-else>{{ $t('prompt.list.no') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="$t('prompt.list.status')" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? $t('prompt.filter.enabled') : $t('prompt.filter.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('prompt.list.operations')" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="handleEdit(row)">
              {{ $t('prompt.actions.edit') }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row.id)">
              {{ $t('prompt.actions.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
          :total="total" layout="total, sizes, prev, pager, next, jumper" />
      </div>
    </div>

    <PromptTemplateEditDrawer v-model:visible="drawerVisible" :template="editingTemplate" @save="handleSave" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { promptTemplateApi, type PromptTemplate } from '@/api/prompt-template'
import PromptTemplateEditDrawer from './components/PromptTemplateEditDrawer.vue'

const { t } = useI18n()

const loading = ref(false)
const templates = ref<PromptTemplate[]>([])
const drawerVisible = ref(false)
const editingTemplate = ref<PromptTemplate | null>(null)

const filters = reactive({
  category: '',
  status: undefined as boolean | undefined,
  keyword: ''
})

const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const fetchTemplates = async () => {
  loading.value = true
  try {
    const response = await promptTemplateApi.findAll({
      page: page.value,
      pageSize: pageSize.value,
      ...filters
    })
    templates.value = response.data.data.list
    total.value = response.data.data.total
  } catch (error: any) {
    ElMessage.error(error.message || t('prompt.messages.fetchListFailed'))
  } finally {
    loading.value = false
  }
}

const handleFilter = () => {
  page.value = 1
  fetchTemplates()
}

watch(pageSize, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    page.value = 1
    fetchTemplates()
  }
})

watch(page, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    fetchTemplates()
  }
})

const handleAdd = () => {
  editingTemplate.value = null
  drawerVisible.value = true
}

const handleEdit = (row: PromptTemplate) => {
  editingTemplate.value = { ...row }
  drawerVisible.value = true
}

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('prompt.messages.deleteConfirm'), t('prompt.messages.deleteConfirmTitle'), {
      confirmButtonText: t('prompt.actions.confirm'),
      cancelButtonText: t('prompt.actions.cancel'),
      type: 'warning'
    })

    await promptTemplateApi.delete(id)
    ElMessage.success(t('prompt.messages.deleteSuccess'))
    fetchTemplates()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || t('prompt.messages.deleteFailed'))
    }
  }
}

const handleSave = async () => {
  drawerVisible.value = false
  fetchTemplates()
}

const getCategoryType = (category: string) => {
  const types: Record<string, any> = {
    agent: 'primary',
    rag: 'success',
    react: 'warning',
    skill: 'info',
    custom: ''
  }
  return types[category] || ''
}

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    agent: t('prompt.categories.agent').split(' - ')[0],
    rag: t('prompt.categories.rag').split(' - ')[0],
    react: t('prompt.categories.react').split(' - ')[0],
    skill: t('prompt.categories.skill').split(' - ')[0],
    custom: t('prompt.categories.custom').split(' - ')[0]
  }
  return labels[category] || category
}

onMounted(() => {
  fetchTemplates()
})
</script>

<style scoped lang="scss">
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .filters {
    display: flex;
    align-items: center;
  }
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>

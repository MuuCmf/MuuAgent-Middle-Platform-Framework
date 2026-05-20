<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">Prompt 模板管理</h1>
      <p class="page-description">管理智能体和 RAG 问答的提示词模板</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">💡 模板管理说明</div>
      <ul>
        <li><strong>模板标识</strong>：模板的唯一标识符，用于在代码中引用模板</li>
        <li><strong>分类</strong>：模板的应用场景，如 agent、rag、react、skill 等</li>
        <li><strong>变量</strong>：模板中可替换的变量，使用 <span v-pre>{{变量名}}</span> 格式</li>
        <li><strong>版本</strong>：模板支持版本管理，每次更新都会创建新版本</li>
        <li><strong>默认模板</strong>：每个分类可以有一个默认模板，智能体会自动使用</li>
      </ul>
    </div>

    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon>
            <Plus />
          </el-icon>
          添加模板
        </el-button>

        <div class="filters">
          <el-select v-model="filters.category" placeholder="选择分类" clearable @change="handleFilter"
            style="width: 150px; margin-right: 12px;">
            <el-option label="Agent" value="agent" />
            <el-option label="RAG" value="rag" />
            <el-option label="ReAct" value="react" />
            <el-option label="Skill" value="skill" />
            <el-option label="自定义" value="custom" />
          </el-select>

          <el-select v-model="filters.status" placeholder="选择状态" clearable @change="handleFilter"
            style="width: 120px; margin-right: 12px;">
            <el-option label="启用" :value="true" />
            <el-option label="禁用" :value="false" />
          </el-select>

          <el-input v-model="filters.keyword" placeholder="搜索模板名称或标识" clearable @change="handleFilter"
            style="width: 250px;">
            <template #prefix>
              <el-icon>
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-table :data="templates" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="code" label="标识" width="150">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="90">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)" size="small">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" label="所属应用" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" type="warning" size="small">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999">全局</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" label="公开状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? '公开' : '私有' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small">v{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isDefault" label="默认" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { promptTemplateApi, type PromptTemplate } from '@/api/prompt-template'
import PromptTemplateEditDrawer from './components/PromptTemplateEditDrawer.vue'

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
    ElMessage.error(error.message || '获取模板列表失败')
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
    await ElMessageBox.confirm('确定要删除该模板吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await promptTemplateApi.delete(id)
    ElMessage.success('删除成功')
    fetchTemplates()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
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
    agent: 'Agent',
    rag: 'RAG',
    react: 'ReAct',
    skill: 'Skill',
    custom: '自定义'
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

.render-dialog-content {
  .render-template-info {
    margin-bottom: 16px;

    p {
      margin: 8px 0;
      font-size: 14px;
      color: #4b5563;
    }
  }

  .render-result {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}

.view-dialog-content {

  .view-content,
  .view-variables {
    margin-top: 16px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}
</style>

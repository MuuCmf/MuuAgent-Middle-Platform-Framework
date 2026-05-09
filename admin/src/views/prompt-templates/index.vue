<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">📝 Prompt 模板管理</h1>
      <p class="page-description">管理智能体和 RAG 问答的提示词模板</p>
    </div>

    <div class="card">
      <div class="card-title">
        模板列表
        <el-tag type="info" size="small">{{ total }} 个</el-tag>
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

      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加模板
        </el-button>

        <div class="filters">
          <el-select
            v-model="filters.category"
            placeholder="选择分类"
            clearable
            @change="handleFilter"
            style="width: 150px; margin-right: 12px;"
          >
            <el-option label="Agent" value="agent" />
            <el-option label="RAG" value="rag" />
            <el-option label="ReAct" value="react" />
            <el-option label="Skill" value="skill" />
            <el-option label="自定义" value="custom" />
          </el-select>

          <el-select
            v-model="filters.status"
            placeholder="选择状态"
            clearable
            @change="handleFilter"
            style="width: 120px; margin-right: 12px;"
          >
            <el-option label="启用" :value="true" />
            <el-option label="禁用" :value="false" />
          </el-select>

          <el-input
            v-model="filters.keyword"
            placeholder="搜索模板名称或标识"
            clearable
            @change="handleFilter"
            style="width: 250px;"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <el-table :data="templates" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column prop="code" label="标识" width="200">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small">v{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isDefault" label="默认" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" @click="handleRender(row)">渲染</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <PromptTemplateEditDrawer
      v-model:visible="drawerVisible"
      :template="editingTemplate"
      @save="handleSave"
    />

    <el-dialog v-model="renderDialogVisible" title="🎨 渲染模板" width="700px">
      <div v-if="renderingTemplate" class="render-dialog-content">
        <div class="render-template-info">
          <p><strong>模板名称：</strong>{{ renderingTemplate.name }}</p>
          <p><strong>模板标识：</strong><el-tag type="info" size="small">{{ renderingTemplate.code }}</el-tag></p>
          <p><strong>模板分类：</strong><el-tag size="small">{{ getCategoryLabel(renderingTemplate.category) }}</el-tag></p>
        </div>

        <el-divider />

        <el-form label-width="100px">
          <el-form-item label="变量参数">
            <div v-if="variables.length > 0">
              <div v-for="variable in variables" :key="variable.name" style="margin-bottom: 12px;">
                <el-input
                  v-model="renderParams[variable.name]"
                  :placeholder="`请输入 ${variable.name}`"
                  style="width: 100%;"
                >
                  <template #prepend>
                    <span style="width: 80px;">{{ variable.name }}</span>
                  </template>
                  <template #append>
                    <el-tag size="small" :type="variable.required ? 'danger' : 'info'">
                      {{ variable.required ? '必填' : '可选' }}
                    </el-tag>
                  </template>
                </el-input>
                <div v-if="variable.description" style="font-size: 12px; color: #999; margin-top: 4px;">
                  {{ variable.description }}
                </div>
              </div>
            </div>
            <el-alert v-else type="info" :closable="false">
              该模板没有定义变量，可以直接渲染
            </el-alert>
          </el-form-item>
        </el-form>

        <el-divider />

        <div class="render-result">
          <h4>渲染结果</h4>
          <el-input
            v-model="renderedPrompt"
            type="textarea"
            :rows="10"
            readonly
            placeholder="点击渲染按钮查看结果"
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="renderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="executeRender" :loading="renderLoading">
          渲染
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="📄 查看模板" width="800px">
      <div v-if="viewingTemplate" class="view-dialog-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="模板名称">{{ viewingTemplate.name }}</el-descriptions-item>
          <el-descriptions-item label="模板标识">
            <el-tag type="info">{{ viewingTemplate.code }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="分类">
            <el-tag :type="getCategoryType(viewingTemplate.category)">
              {{ getCategoryLabel(viewingTemplate.category) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            <el-tag size="small">v{{ viewingTemplate.version }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="viewingTemplate.status ? 'success' : 'danger'" size="small">
              {{ viewingTemplate.status ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="默认模板">
            <el-tag v-if="viewingTemplate.isDefault" type="success" size="small">是</el-tag>
            <span v-else>否</span>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ viewingTemplate.description || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">
            {{ formatDate(viewingTemplate.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div class="view-content">
          <h4>模板内容</h4>
          <el-input
            :model-value="viewingTemplate.content"
            type="textarea"
            :rows="15"
            readonly
          />
        </div>

        <div v-if="viewingTemplate.variables" class="view-variables">
          <h4>变量定义</h4>
          <el-table :data="parseVariables(viewingTemplate.variables)" border>
            <el-table-column prop="name" label="变量名" width="150" />
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column prop="required" label="必填" width="80">
              <template #default="{ row }">
                <el-tag :type="row.required ? 'danger' : 'info'" size="small">
                  {{ row.required ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" />
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { promptTemplateApi, type PromptTemplate, type VariableDefinition } from '@/api/prompt-template'
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

const renderDialogVisible = ref(false)
const renderingTemplate = ref<PromptTemplate | null>(null)
const renderParams = reactive<Record<string, any>>({})
const variables = ref<VariableDefinition[]>([])
const renderedPrompt = ref('')
const renderLoading = ref(false)

const viewDialogVisible = ref(false)
const viewingTemplate = ref<PromptTemplate | null>(null)

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

const handleView = (row: PromptTemplate) => {
  viewingTemplate.value = row
  viewDialogVisible.value = true
}

const handleRender = (row: PromptTemplate) => {
  renderingTemplate.value = row
  variables.value = row.variables ? JSON.parse(row.variables) : []
  Object.keys(renderParams).forEach(key => delete renderParams[key])
  renderedPrompt.value = ''
  renderDialogVisible.value = true
}

const executeRender = async () => {
  if (!renderingTemplate.value) return

  const missingRequired = variables.value.filter(v => v.required && !renderParams[v.name])
  if (missingRequired.length > 0) {
    ElMessage.warning(`请填写必填变量: ${missingRequired.map(v => v.name).join(', ')}`)
    return
  }

  renderLoading.value = true
  try {
    const response = await promptTemplateApi.render({
      code: renderingTemplate.value.code,
      variables: renderParams
    })
    renderedPrompt.value = response.data.data.renderedPrompt
    ElMessage.success('渲染成功')
  } catch (error: any) {
    ElMessage.error(error.message || '渲染失败')
  } finally {
    renderLoading.value = false
  }
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

const parseVariables = (variablesStr: string): VariableDefinition[] => {
  try {
    return JSON.parse(variablesStr)
  } catch {
    return []
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
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

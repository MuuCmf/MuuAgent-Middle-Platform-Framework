<template>
  <div class="card">
    <div class="card-title">
      模板列表
      <el-tag type="info" size="small">{{ templates.length }} 个</el-tag>
    </div>

    <div class="help-tip" style="margin-bottom: 20px;">
      <div class="help-tip-title">💡 模板说明</div>
      <ul>
        <li><strong>温度参数</strong>：控制模型输出的随机性，值越低越精准，值越高越有创意</li>
        <li><strong>核采样参数</strong>：控制模型输出的多样性，通常固定为0.7-0.9</li>
        <li><strong>上下文窗口</strong>：模型可处理的最大输入token数</li>
        <li><strong>最大生成长度</strong>：模型单次输出的最大token数</li>
      </ul>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px;">
      <el-button type="primary" @click="handleAddTemplate">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>

      <el-select v-model="filterModelType" placeholder="模型类型" clearable style="width: 150px;" @change="loadTemplates">
        <el-option label="LLM" value="llm" />
        <el-option label="向量模型" value="embedding" />
        <el-option label="多模态" value="multimodal" />
      </el-select>

      <el-select v-model="filterSceneTag" placeholder="场景标签" clearable style="width: 150px;" @change="loadTemplates">
        <el-option label="客服问答" value="customer_service" />
        <el-option label="创意文案" value="creative" />
        <el-option label="向量生成" value="vector" />
        <el-option label="多模态生成" value="multimodal" />
        <el-option label="代码生成" value="code" />
      </el-select>
    </div>

    <el-table :data="templates" stripe v-loading="templatesLoading">
      <el-table-column prop="name" label="模板名称" width="180" />
      <el-table-column prop="code" label="标识" width="200">
        <template #default="{ row }">
          <el-tag type="info">{{ row.code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="modelType" label="模型类型" width="100">
        <template #default="{ row }">
          <el-tag>{{ getModelTypeLabel(row.modelType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sceneTag" label="场景标签" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.sceneTag" type="warning">{{ getSceneTagLabel(row.sceneTag) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="参数配置" width="280">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag size="small">温度: {{ row.temperature }}</el-tag>
            <el-tag size="small">TopP: {{ row.topP }}</el-tag>
            <el-tag size="small">窗口: {{ row.contextWindow }}</el-tag>
            <el-tag size="small">最大: {{ row.maxTokens }}</el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column prop="isDefault" label="默认" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" type="success">默认</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">
            {{ row.status ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditTemplate(row)">编辑</el-button>
          <el-button size="small" type="warning" @click="handleCopyTemplate(row.id)">复制</el-button>
          <el-button size="small" type="success" @click="handleSetDefaultTemplate(row.id)" :disabled="row.isDefault">
            设为默认
          </el-button>
          <el-button size="small" type="danger" @click="handleDeleteTemplate(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="templateDialogVisible" :title="editingTemplate ? '编辑模板' : '新建模板'" width="700px">
    <el-form :model="templateForm" label-width="120px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="模板名称" required>
            <el-input v-model="templateForm.name" placeholder="如：客服问答模板" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="模板标识" required>
            <el-input v-model="templateForm.code" placeholder="如：customer-service-template" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="模型类型" required>
            <el-select v-model="templateForm.modelType" style="width: 100%;">
              <el-option label="LLM (大语言模型)" value="llm" />
              <el-option label="Embedding (向量模型)" value="embedding" />
              <el-option label="Multimodal (多模态)" value="multimodal" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="场景标签">
            <el-select v-model="templateForm.sceneTag" style="width: 100%;" clearable>
              <el-option label="客服问答" value="customer_service" />
              <el-option label="创意文案" value="creative" />
              <el-option label="向量生成" value="vector" />
              <el-option label="多模态生成" value="multimodal" />
              <el-option label="代码生成" value="code" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="温度参数">
            <el-slider v-model="templateForm.temperature" :min="0" :max="1" :step="0.1" show-input />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="核采样参数">
            <el-slider v-model="templateForm.topP" :min="0" :max="1" :step="0.1" show-input />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="上下文窗口">
            <el-input-number v-model="templateForm.contextWindow" :min="1" :step="1024" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="最大生成长度">
            <el-input-number v-model="templateForm.maxTokens" :min="1" :step="100" style="width: 100%;" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="模板描述">
        <el-input v-model="templateForm.description" type="textarea" :rows="2" placeholder="描述模板的用途和特点" />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="templateForm.remark" type="textarea" :rows="2" placeholder="其他补充说明" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="设为默认">
            <el-switch v-model="templateForm.isDefault" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="启用状态">
            <el-switch v-model="templateForm.status" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="templateDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSaveTemplate">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { modelTemplateApi } from '@/api/model-template'
import type { ModelTemplate, ModelTemplateForm } from '@/api/model-template'

const templates = ref<ModelTemplate[]>([])
const templatesLoading = ref(false)
const filterModelType = ref('')
const filterSceneTag = ref('')

const templateDialogVisible = ref(false)
const editingTemplate = ref<ModelTemplate | null>(null)
const templateForm = ref<ModelTemplateForm>({
  name: '',
  code: '',
  modelType: 'llm',
  temperature: 0.7,
  topP: 0.7,
  contextWindow: 8192,
  maxTokens: 1000,
  sceneTag: '',
  description: '',
  remark: '',
  isDefault: false,
  status: true
})

/**
 * 重置模板表单
 */
const resetTemplateForm = () => {
  templateForm.value = {
    name: '',
    code: '',
    modelType: 'llm',
    temperature: 0.7,
    topP: 0.7,
    contextWindow: 8192,
    maxTokens: 1000,
    sceneTag: '',
    description: '',
    remark: '',
    isDefault: false,
    status: true
  }
  editingTemplate.value = null
}

/**
 * 获取模型类型中文名
 * @param type 模型类型
 * @returns 中文名
 */
const getModelTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    llm: 'LLM',
    embedding: '向量模型',
    multimodal: '多模态'
  }
  return typeMap[type] || type
}

/**
 * 获取场景标签中文名
 * @param tag 场景标签
 * @returns 中文名
 */
const getSceneTagLabel = (tag: string): string => {
  const tagMap: Record<string, string> = {
    customer_service: '客服问答',
    creative: '创意文案',
    vector: '向量生成',
    multimodal: '多模态生成',
    code: '代码生成'
  }
  return tagMap[tag] || tag
}

/**
 * 加载模板列表
 */
const loadTemplates = async () => {
  templatesLoading.value = true
  try {
    const params: any = {}
    if (filterModelType.value) params.modelType = filterModelType.value
    if (filterSceneTag.value) params.sceneTag = filterSceneTag.value

    const { data } = await modelTemplateApi.getList(params)
    templates.value = data.data.list || []
  } catch (error) {
    console.error('加载模板列表失败', error)
    ElMessage.error('加载模板列表失败')
  } finally {
    templatesLoading.value = false
  }
}

/**
 * 添加模板
 */
const handleAddTemplate = () => {
  resetTemplateForm()
  templateDialogVisible.value = true
}

/**
 * 编辑模板
 * @param template 模板对象
 */
const handleEditTemplate = (template: ModelTemplate) => {
  editingTemplate.value = template
  templateForm.value = { ...template }
  templateDialogVisible.value = true
}

/**
 * 保存模板
 */
const handleSaveTemplate = async () => {
  if (!templateForm.value.name || !templateForm.value.code || !templateForm.value.modelType) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    if (editingTemplate.value) {
      await modelTemplateApi.update(editingTemplate.value.id, templateForm.value)
      ElMessage.success('更新成功')
    } else {
      await modelTemplateApi.create(templateForm.value)
      ElMessage.success('创建成功')
    }
    templateDialogVisible.value = false
    loadTemplates()
  } catch (error: any) {
    console.error('保存失败', error)
    ElMessage.error(error.response?.data?.message || '保存失败')
  }
}

/**
 * 删除模板
 * @param id 模板ID
 */
const handleDeleteTemplate = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定删除该模板？', '提示', {
      type: 'warning'
    })
    await modelTemplateApi.delete(id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败', error)
      ElMessage.error(error.response?.data?.message || '删除失败')
    }
  }
}

/**
 * 复制模板
 * @param id 模板ID
 */
const handleCopyTemplate = async (id: string) => {
  try {
    await modelTemplateApi.copy(id)
    ElMessage.success('复制成功')
    loadTemplates()
  } catch (error: any) {
    console.error('复制失败', error)
    ElMessage.error(error.response?.data?.message || '复制失败')
  }
}

/**
 * 设为默认模板
 * @param id 模板ID
 */
const handleSetDefaultTemplate = async (id: string) => {
  try {
    await modelTemplateApi.setDefault(id)
    ElMessage.success('设置成功')
    loadTemplates()
  } catch (error: any) {
    console.error('设置失败', error)
    ElMessage.error(error.response?.data?.message || '设置失败')
  }
}

onMounted(() => {
  loadTemplates()
})
</script>
<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">🔧 模型配置中心</h1>
      <p class="page-description">统一管理AI模型配置和参数模板，实现模型资源的标准化和规范化管理</p>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型管理" name="models">
        <div class="card">
          <div class="card-title">
            模型列表
            <el-tag type="info" size="small">{{ models.length }} 个</el-tag>
          </div>

          <div class="help-tip" style="margin-bottom: 20px;">
            <div class="help-tip-title">💡 模型管理说明</div>
            <ul>
              <li><strong>模型</strong>：AI服务的具体实例，如 GPT-4、Claude、本地 Ollama 模型等</li>
              <li><strong>模型标识</strong>：唯一标识符，用于API调用时指定模型</li>
              <li><strong>权重</strong>：负载均衡时的选择权重，权重越高被选中概率越大</li>
              <li><strong>状态</strong>：启用/禁用，禁用的模型不参与调度</li>
            </ul>
          </div>

          <el-button type="primary" @click="handleAddModel" style="margin-bottom: 16px;">
            <el-icon><Plus /></el-icon>
            添加模型
          </el-button>

          <el-table :data="models" stripe v-loading="modelsLoading">
            <el-table-column prop="name" label="名称" />
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
            <el-table-column prop="category" label="分类" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.category" type="warning">{{ getCategoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="tags" label="标签" width="200">
              <template #default="{ row }">
                <el-space wrap>
                  <el-tag v-for="tag in parseTags(row.tags)" :key="tag" size="small" type="success">
                    {{ getTagLabel(tag) }}
                  </el-tag>
                </el-space>
              </template>
            </el-table-column>
            <el-table-column prop="provider" label="提供商" width="120" />
            <el-table-column prop="weight" label="权重" width="80" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'danger'">
                  {{ row.status ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="kbUsageCount" label="知识库使用" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.kbUsageCount > 0" type="warning">
                  {{ row.kbUsageCount }} 个
                </el-tag>
                <el-tag v-else type="info">未使用</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEditModel(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteModel(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="参数模板" name="templates">
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
            <el-table-column label="操作" width="280">
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
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="modelDialogVisible" :title="editingModel ? '编辑模型' : '添加模型'" width="600px">
      <el-form :model="modelForm" label-width="100px">
        <el-form-item label="模型名称" required>
          <el-input v-model="modelForm.name" placeholder="如：GPT-4、Claude-3" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模型标识" required>
              <el-input v-model="modelForm.code" placeholder="如：gpt-4、claude-3-opus" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模型类型" required>
              <el-select v-model="modelForm.type" style="width: 100%;">
                <el-option label="LLM (大语言模型)" value="llm" />
                <el-option label="Embedding (向量模型)" value="embedding" />
                <el-option label="TTS (语音合成)" value="tts" />
                <el-option label="ASR (语音识别)" value="asr" />
                <el-option label="Image (图像生成)" value="image" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="提供商">
              <el-select v-model="modelForm.provider" style="width: 100%;">
                <el-option label="Ollama (本地)" value="ollama" />
                <el-option label="OpenAI" value="openai" />
                <el-option label="Azure OpenAI" value="azure" />
                <el-option label="阿里云通义" value="aliyun" />
                <el-option label="腾讯混元" value="tencent" />
                <el-option label="字节豆包" value="doubao" />
                <el-option label="科大讯飞星火" value="xfyun" />
                <el-option label="华为云盘古" value="huawei" />
                <el-option label="百川智能" value="baichuan" />
                <el-option label="MINIMAX" value="minimax" />
                <el-option label="智谱AI" value="zhipu" />
                <el-option label="DeepSeek" value="deepseek" />
                <el-option label="商汤日日新" value="sensetime" />
                <el-option label="京东言犀" value="jd" />
                <el-option label="火山引擎" value="volcengine" />
                <el-option label="百度文心" value="baidu" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权重">
              <el-input-number v-model="modelForm.weight" :min="1" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="API地址">
          <el-input v-model="modelForm.endpoint" placeholder="如：https://api.openai.com/v1/chat/completions" />
        </el-form-item>

        <el-form-item label="API密钥">
          <el-input v-model="modelForm.apiKey" type="password" placeholder="留空则不传递" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大Token">
              <el-input-number v-model="modelForm.maxTokens" :min="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="温度参数">
              <el-input-number v-model="modelForm.temperature" :min="0" :max="1" :step="0.1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模型分类">
              <el-select v-model="modelForm.category" placeholder="请选择分类" style="width: 100%;" clearable>
                <el-option label="通用" value="general" />
                <el-option label="编程" value="code" />
                <el-option label="数学" value="math" />
                <el-option label="创意" value="creative" />
                <el-option label="专业" value="professional" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模型标签">
              <el-select
                v-model="selectedTags"
                multiple
                placeholder="请选择标签"
                style="width: 100%;"
                @change="handleTagsChange"
              >
                <el-option label="对话" value="chat" />
                <el-option label="推理" value="reasoning" />
                <el-option label="绘图" value="drawing" />
                <el-option label="向量" value="embedding" />
                <el-option label="语音" value="voice" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态">
          <el-switch v-model="modelForm.status" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modelDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveModel">保存</el-button>
      </template>
    </el-dialog>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useModelStore } from '@/stores/model'
import type { Model, ModelForm } from '@/api/model'
import { modelTemplateApi } from '@/api/model-template'
import type { ModelTemplate, ModelTemplateForm } from '@/api/model-template'

const activeTab = ref('models')

const modelStore = useModelStore()
const models = computed(() => modelStore.models)
const modelsLoading = computed(() => modelStore.loading)
const { loadModels, createModel, updateModel, deleteModel } = modelStore

const templates = ref<ModelTemplate[]>([])
const templatesLoading = ref(false)
const filterModelType = ref('')
const filterSceneTag = ref('')

const modelDialogVisible = ref(false)
const editingModel = ref<Model | null>(null)
const selectedTags = ref<string[]>([])
const modelForm = ref<ModelForm>({
  name: '',
  code: '',
  type: 'llm',
  provider: 'openai',
  endpoint: '',
  apiKey: '',
  weight: 10,
  maxTokens: 4096,
  temperature: 0.7,
  status: true,
  tags: '',
  category: ''
})

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

const resetModelForm = () => {
  modelForm.value = {
    name: '',
    code: '',
    type: 'llm',
    provider: 'openai',
    endpoint: '',
    apiKey: '',
    weight: 10,
    maxTokens: 4096,
    temperature: 0.7,
    status: true,
    tags: '',
    category: ''
  }
  selectedTags.value = []
  editingModel.value = null
}

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

const handleAddModel = () => {
  resetModelForm()
  modelDialogVisible.value = true
}

const handleEditModel = (model: Model) => {
  editingModel.value = model
  modelForm.value = { ...model }
  selectedTags.value = parseTags(model.tags)
  modelDialogVisible.value = true
}

const handleTagsChange = (tags: string[]) => {
  modelForm.value.tags = JSON.stringify(tags)
}

const parseTags = (tags?: string): string[] => {
  if (!tags) return []
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

const getTagLabel = (tag: string): string => {
  const tagMap: Record<string, string> = {
    chat: '对话',
    reasoning: '推理',
    drawing: '绘图',
    embedding: '向量',
    voice: '语音'
  }
  return tagMap[tag] || tag
}

const getCategoryLabel = (category: string): string => {
  const categoryMap: Record<string, string> = {
    general: '通用',
    code: '编程',
    math: '数学',
    creative: '创意',
    professional: '专业'
  }
  return categoryMap[category] || category
}

const handleSaveModel = async () => {
  if (!modelForm.value.name || !modelForm.value.code) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    if (editingModel.value) {
      await updateModel(editingModel.value.id, modelForm.value)
      ElMessage.success('更新成功')
    } else {
      await createModel(modelForm.value)
      ElMessage.success('创建成功')
    }
    modelDialogVisible.value = false
  } catch (error: any) {
    console.error('保存失败', error)
    ElMessage.error(error.response?.data?.message || '保存失败')
  }
}

const handleDeleteModel = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除该模型？', '提示', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    
    try {
      await deleteModel(id)
      ElMessage.success('删除成功')
      await loadModels()
    } catch (error: any) {
      console.error('删除模型失败', error)
      const errorMsg = error.response?.data?.message || error.message || '删除失败'
      ElMessage.error(errorMsg)
    }
  } catch (error) {
    console.log('用户取消删除操作')
  }
}

const handleAddTemplate = () => {
  resetTemplateForm()
  templateDialogVisible.value = true
}

const handleEditTemplate = (template: ModelTemplate) => {
  editingTemplate.value = template
  templateForm.value = { ...template }
  templateDialogVisible.value = true
}

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

const getModelTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    llm: 'LLM',
    embedding: '向量模型',
    multimodal: '多模态'
  }
  return typeMap[type] || type
}

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

onMounted(() => {
  loadModels()
  loadTemplates()
})
</script>

<style lang="scss" scoped>
</style>

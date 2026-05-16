<template>
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
      <el-table-column label="操作" width="140" fixed="right" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditModel(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDeleteModel(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

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
              <el-option label="DeepSeek" value="deepseek" />
              <el-option label="智谱AI" value="zhipu" />
              <el-option label="阿里云通义" value="aliyun" />
              <el-option label="腾讯混元" value="tencent" />
              <el-option label="火山引擎" value="volcengine" />
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
              <el-option label="生图" value="image" />
              <el-option label="语音合成" value="tts" />
              <el-option label="语音识别" value="asr" />
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useModelStore } from '@/stores/model'
import type { Model, ModelForm } from '@/api/model'

const modelStore = useModelStore()
const models = computed(() => modelStore.models)
const modelsLoading = computed(() => modelStore.loading)
const { loadModels, createModel, updateModel, deleteModel } = modelStore

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

/**
 * 重置模型表单
 */
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

/**
 * 解析标签JSON字符串
 * @param tags 标签JSON字符串
 * @returns 标签数组
 */
const parseTags = (tags?: string): string[] => {
  if (!tags) return []
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

/**
 * 获取标签中文名
 * @param tag 标签值
 * @returns 标签中文名
 */
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

/**
 * 获取分类中文名
 * @param category 分类值
 * @returns 分类中文名
 */
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

/**
 * 标签变更处理
 * @param tags 选中的标签数组
 */
const handleTagsChange = (tags: string[]) => {
  modelForm.value.tags = JSON.stringify(tags)
}

/**
 * 添加模型
 */
const handleAddModel = () => {
  resetModelForm()
  modelDialogVisible.value = true
}

/**
 * 编辑模型
 * @param model 模型对象
 */
const handleEditModel = (model: Model) => {
  editingModel.value = model
  modelForm.value = { ...model }
  selectedTags.value = parseTags(model.tags)
  modelDialogVisible.value = true
}

/**
 * 保存模型
 */
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

/**
 * 删除模型
 * @param id 模型ID
 */
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

onMounted(() => {
  loadModels()
})
</script>
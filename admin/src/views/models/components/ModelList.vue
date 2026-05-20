<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 {{ $t('model.modelManagementTip') }}</div>
    <ul>
      <li><strong>{{ $t('model.modelManagementDesc') }}</strong></li>
      <li><strong>{{ $t('model.modelIdDesc') }}</strong></li>
      <li><strong>{{ $t('model.weightDesc') }}</strong></li>
      <li><strong>{{ $t('model.statusDesc') }}</strong></li>
    </ul>
  </div>
  <div class="card">

    <el-button type="primary" @click="handleAddModel" style="margin-bottom: 16px;">
      <el-icon>
        <Plus />
      </el-icon>
      {{ $t('model.addModel') }}
    </el-button>

    <el-table :data="models" stripe v-loading="modelsLoading">
      <el-table-column prop="name" :label="$t('model.modelName')" />
      <el-table-column prop="code" :label="$t('model.modelId')" width="180">
        <template #default="{ row }">
          <el-tag type="info">{{ row.code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="type" :label="$t('model.modelType')" width="120">
        <template #default="{ row }">
          <el-tag>{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="category" :label="$t('model.category')" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.category" type="warning">{{ getCategoryLabel(row.category) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="tags" :label="$t('model.tags')" width="200">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag v-for="tag in parseTags(row.tags)" :key="tag" size="small" type="success">
              {{ getTagLabel(tag) }}
            </el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column prop="provider" :label="$t('model.provider')" width="120" />
      <el-table-column prop="weight" :label="$t('model.weight')" width="80" />
      <el-table-column prop="status" :label="$t('model.status')" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">
            {{ row.status ? $t('model.enabled') : $t('model.disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="kbUsageCount" :label="$t('model.kbUsage')" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.kbUsageCount > 0" type="warning">
            {{ row.kbUsageCount }} {{ $t('model.modelCount') }}
          </el-tag>
          <el-tag v-else type="info">{{ $t('model.unused') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.actions')" width="140" fixed="right" align="right">
        <template #default="{ row }">
          <el-button link size="small" type="primary" @click="handleEditModel(row)">{{ $t('common.edit') }}</el-button>
          <el-button link size="small" type="danger" @click="handleDeleteModel(row.id)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="modelDialogVisible" :title="editingModel ? $t('model.editModel') : $t('model.addModel')"
    width="600px">
    <el-form :model="modelForm" label-width="100px">
      <el-form-item :label="$t('model.modelName')" required>
        <el-input v-model="modelForm.name" :placeholder="$t('model.modelNamePlaceholder')" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('model.modelId')" required>
            <el-input v-model="modelForm.code" :placeholder="$t('model.modelTypePlaceholder')" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('model.modelType')" required>
            <el-select v-model="modelForm.type" style="width: 100%;">
              <el-option :label="$t('model.llm')" value="llm" />
              <el-option :label="$t('model.embedding')" value="embedding" />
              <el-option :label="$t('model.tts')" value="tts" />
              <el-option :label="$t('model.asr')" value="asr" />
              <el-option :label="$t('model.image')" value="image" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('model.provider')">
            <el-select v-model="modelForm.provider" style="width: 100%;">
              <el-option :label="$t('model.ollama')" value="ollama" />
              <el-option :label="$t('model.openai')" value="openai" />
              <el-option :label="$t('model.azure')" value="azure" />
              <el-option :label="$t('model.deepseek')" value="deepseek" />
              <el-option :label="$t('model.zhipu')" value="zhipu" />
              <el-option :label="$t('model.aliyun')" value="aliyun" />
              <el-option :label="$t('model.tencent')" value="tencent" />
              <el-option :label="$t('model.volcengine')" value="volcengine" />
              <el-option :label="$t('model.custom')" value="custom" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('model.weight')">
            <el-input-number v-model="modelForm.weight" :min="1" :max="100" style="width: 100%;" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('model.endpoint')">
        <el-input v-model="modelForm.endpoint" :placeholder="$t('model.endpointPlaceholder')" />
      </el-form-item>

      <el-form-item :label="$t('model.apiKey')">
        <div class="api-key-wrapper">
          <el-input v-model="modelForm.apiKey" type="password" show-password
            :placeholder="hasExistingApiKey ? $t('model.apiKeySet') : $t('model.apiKeyEmpty')"
            :disabled="clearApiKey" />
          <el-checkbox v-if="editingModel && hasExistingApiKey" v-model="clearApiKey"
            :label="$t('model.clearApiKey')" />
        </div>
        <div class="form-tip" v-if="editingModel && hasExistingApiKey && !clearApiKey">
          {{ $t('model.apiKeySaved') }}
        </div>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('model.category')">
            <el-select v-model="modelForm.category" :placeholder="$t('model.modelTypePlaceholder')" style="width: 100%;"
              clearable>
              <el-option :label="$t('model.general')" value="general" />
              <el-option :label="$t('model.code')" value="code" />
              <el-option :label="$t('model.math')" value="math" />
              <el-option :label="$t('model.creative')" value="creative" />
              <el-option :label="$t('model.imageGen')" value="image" />
              <el-option :label="$t('model.voiceSynthesis')" value="tts" />
              <el-option :label="$t('model.voiceRecognition')" value="asr" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('model.tags')">
            <el-select v-model="selectedTags" multiple :placeholder="$t('model.modelTypePlaceholder')"
              style="width: 100%;" @change="handleTagsChange">
              <el-option :label="$t('model.chat')" value="chat" />
              <el-option :label="$t('model.reasoning')" value="reasoning" />
              <el-option :label="$t('model.drawing')" value="drawing" />
              <el-option :label="$t('model.vector')" value="embedding" />
              <el-option :label="$t('model.voice')" value="voice" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('model.status')">
        <el-switch v-model="modelForm.status" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="modelDialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSaveModel">{{ $t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useModelStore } from '@/stores/model'
import type { Model, ModelForm } from '@/api/model'

const { t } = useI18n()
const modelStore = useModelStore()
const models = computed(() => modelStore.models)
const modelsLoading = computed(() => modelStore.loading)
const { loadModels, createModel, updateModel, deleteModel } = modelStore

const modelDialogVisible = ref(false)
const editingModel = ref<Model | null>(null)
const selectedTags = ref<string[]>([])
const clearApiKey = ref(false)
const modelForm = ref<ModelForm>({
  name: '',
  code: '',
  type: 'llm',
  provider: 'openai',
  endpoint: '',
  apiKey: '',
  weight: 10,
  status: true,
  tags: '',
  category: ''
})

const hasExistingApiKey = computed(() => {
  return !!editingModel.value?.hasApiKey
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
    status: true,
    tags: '',
    category: ''
  }
  selectedTags.value = []
  clearApiKey.value = false
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
    chat: t('model.chat'),
    reasoning: t('model.reasoning'),
    drawing: t('model.drawing'),
    embedding: t('model.vector'),
    voice: t('model.voice')
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
    general: t('model.general'),
    code: t('model.code'),
    math: t('model.math'),
    creative: t('model.creative'),
    professional: t('model.creative')
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
  modelForm.value = { ...model, apiKey: '' }
  selectedTags.value = parseTags(model.tags)
  clearApiKey.value = false
  modelDialogVisible.value = true
}

/**
 * 保存模型
 */
const handleSaveModel = async () => {
  if (!modelForm.value.name || !modelForm.value.code) {
    ElMessage.warning(t('model.pleaseFillRequired'))
    return
  }

  try {
    if (editingModel.value) {
      const updateData = {
        ...modelForm.value,
        apiKey: clearApiKey.value ? null : modelForm.value.apiKey || undefined
      }
      await updateModel(editingModel.value.id, updateData)
      ElMessage.success(t('model.updateSuccess'))
    } else {
      await createModel(modelForm.value)
      ElMessage.success(t('model.createSuccess'))
    }
    modelDialogVisible.value = false
  } catch (error: any) {
    console.error('保存失败', error)
    ElMessage.error(error.response?.data?.message || t('model.updateFailed'))
  }
}

/**
 * 删除模型
 * @param id 模型ID
 */
const handleDeleteModel = async (id: number) => {
  try {
    await ElMessageBox.confirm(t('model.deleteConfirm'), t('model.deleteTitle'), {
      type: 'warning',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })

    try {
      await deleteModel(id)
      ElMessage.success(t('model.deleteSuccess'))
      await loadModels()
    } catch (error: any) {
      console.error('删除模型失败', error)
      const errorMsg = error.response?.data?.message || error.message || t('model.deleteFailed')
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

<style scoped lang="scss">
.api-key-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;

  .el-input {
    flex: 1;
  }
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
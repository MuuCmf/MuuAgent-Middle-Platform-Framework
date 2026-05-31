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
      <el-table-column prop="name" :label="$t('model.modelName')" width="200" />
      <el-table-column prop="code" :label="$t('model.modelId')" width="180">
        <template #default="{ row }">
          <el-tag type="info">{{ row.code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="type" :label="$t('model.modelType')" width="120">
        <template #default="{ row }">
          <el-tag>
            <template v-if="row.type === 'tts'">🔊 </template>
            <template v-else-if="row.type === 'asr'">🎤 </template>
            {{ row.type }}
          </el-tag>
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
      <el-table-column prop="capabilities" :label="$t('model.capabilities')" width="200">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag v-if="getCapabilities(row.capabilities).includes('tts:realtime')" size="small" type="primary">{{
              $t('model.capTtsRealtime') }}</el-tag>
            <el-tag v-if="getCapabilities(row.capabilities).includes('tts')" size="small" type="warning">{{
              $t('model.capTts') }}</el-tag>
            <el-tag v-if="getCapabilities(row.capabilities).includes('asr')" size="small" type="success">{{
              $t('model.capAsr') }}</el-tag>
            <span v-if="!row.capabilities" class="no-cap">-</span>
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
      <el-table-column :label="$t('common.actions')" width="200" fixed="right" align="right">
        <template #default="{ row }">
          <el-button link size="small" type="primary" @click="handleEditModel(row)">{{ $t('common.edit') }}</el-button>
          <el-button v-if="row.type === 'tts' || row.type === 'asr'" link size="small" type="success"
            @click="handleTestModel(row)">{{ $t('model.testModel') }}</el-button>
          <el-button link size="small" type="danger" @click="handleDeleteModel(row.id)">{{ $t('common.delete')
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="modelDialogVisible" :title="editingModel ? $t('model.editModel') : $t('model.addModel')"
    direction="rtl" size="560px" class="model-drawer">
    <el-form :model="modelForm" label-width="100px" class="model-form">
      <!-- ========== 模型类型 ========== -->
      <div class="form-section form-section-type">
        <div class="section-label">{{ $t('model.modelType') }} <span class="required-mark">*</span></div>
        <div class="model-type-cards">
          <div v-for="item in modelTypeOptions" :key="item.value"
            :class="['model-type-card', { active: modelForm.type === item.value }]"
            @click="handleTypeChange(item.value)">
            <span class="model-type-icon">
              <el-icon :size="20">
                <component :is="item.icon" />
              </el-icon>
            </span>
            <span class="model-type-name">{{ item.label }}</span>
            <span class="model-type-desc">{{ item.desc }}</span>
          </div>
        </div>
      </div>

      <!-- ========== 基本信息 ========== -->
      <div class="form-section">
        <div class="section-title">{{ $t('model.basicInfo') }}</div>

        <el-form-item :label="$t('model.modelName')" required>
          <el-input v-model="modelForm.name" :placeholder="$t('model.modelNamePlaceholder')" />
        </el-form-item>

        <el-form-item :label="$t('model.modelId')" required>
          <el-input v-model="modelForm.code" :placeholder="$t('model.modelIdPlaceholder')" />
        </el-form-item>

        <el-form-item :label="$t('model.weight')">
          <el-input-number v-model="modelForm.weight" :min="1" :max="100" style="width: 100%;" />
        </el-form-item>

      </div>

      <!-- ========== 连接配置 ========== -->
      <div class="form-section">
        <div class="section-title">{{ $t('model.connectionConfig') }}</div>

        <el-form-item :label="$t('model.provider')">
          <el-select v-model="modelForm.provider" style="width: 100%;" :loading="providersLoading"
            @change="handleProviderChange">
            <el-option v-for="p in providerOptions" :key="p.value" :label="p.label" :value="p.value">
              <span class="provider-option">
                <span class="provider-dot" :style="{ background: getProviderColor(p.value) }"></span>
                <span>{{ p.label }}</span>
              </span>
            </el-option>
          </el-select>
          <div class="field-hint" v-if="currentProviderHint">{{ currentProviderHint }}</div>
        </el-form-item>

        <el-form-item :label="$t('model.endpoint')">
          <el-input v-model="modelForm.endpoint" :placeholder="$t('model.endpointPlaceholder')" />
        </el-form-item>

        <el-form-item :label="$t('model.apiKey')">
          <div class="api-key-wrapper">
            <el-input v-model="modelForm.apiKey" type="password" show-password
              :placeholder="hasExistingApiKey ? $t('model.apiKeySet') : $t('model.apiKeyEmpty')"
              :disabled="clearApiKey" />
            <el-checkbox v-if="editingModel && hasExistingApiKey" v-model="clearApiKey">
              {{ $t('model.clearApiKey') }}
            </el-checkbox>
          </div>
          <div class="field-hint" v-if="editingModel && hasExistingApiKey && !clearApiKey">
            {{ $t('model.apiKeySaved') }}
          </div>
        </el-form-item>
      </div>

      <!-- ========== 高级选项 ========== -->
      <div class="form-section">
        <div class="section-title">{{ $t('model.advancedOptions') }}</div>

        <el-form-item :label="$t('model.tags')">
          <el-select v-model="selectedTags" multiple :placeholder="$t('model.modelTypePlaceholder')"
            style="width: 100%;" @change="handleTagsChange">
            <el-option :label="$t('model.chat')" value="chat" />
            <el-option :label="$t('model.code')" value="code" />
            <el-option :label="$t('model.math')" value="math" />
            <el-option :label="$t('model.creative')" value="creative" />
            <el-option :label="$t('model.reasoning')" value="reasoning" />
          </el-select>
          <div class="field-hint">{{ $t('model.tagsHint') }}</div>
        </el-form-item>

        <!-- TTS/ASR 能力声明 -->
        <el-form-item v-if="modelForm.type === 'tts' || modelForm.type === 'asr'" :label="$t('model.capabilities')">
          <el-checkbox-group v-model="selectedCapabilities" @change="handleCapabilitiesChange">
            <el-checkbox v-if="modelForm.type === 'tts'" value="tts">{{ $t('model.capTts') }}</el-checkbox>
            <el-checkbox v-if="modelForm.type === 'tts'" value="tts:realtime">{{ $t('model.capTtsRealtime')
            }}</el-checkbox>
            <el-checkbox v-if="modelForm.type === 'asr'" value="asr">{{ $t('model.capAsr') }}</el-checkbox>
          </el-checkbox-group>
          <div class="field-hint">{{ $t('model.capabilitiesTip') }}</div>
        </el-form-item>
      </div>

      <!-- ========== 状态 ========== -->
      <div class="form-section form-section-bottom">
        <el-form-item :label="$t('model.status')">
          <el-switch v-model="modelForm.status"
            :active-text="modelForm.status ? $t('model.enabled') : $t('model.disabled')" />
        </el-form-item>

        <el-alert v-if="modelForm.type === 'tts' || modelForm.type === 'asr'"
          :title="modelForm.type === 'tts' ? $t('model.ttsTip') : $t('model.asrTip')"
          :description="modelForm.type === 'tts' ? $t('model.ttsTipDesc') : $t('model.asrTipDesc')" type="info"
          show-icon :closable="false" />
      </div>
    </el-form>

    <template #footer>
      <el-button @click="modelDialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSaveModel">{{ $t('common.save') }}</el-button>
    </template>
  </el-drawer>

  <VoiceModelTestDrawer v-model:visible="testDrawerVisible" :test-type="testModelType" :model-code="testModelCode" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ChatDotSquare, Grid, Headset, Microphone, Picture, Monitor, Phone } from '@element-plus/icons-vue'
import { useModelStore } from '@/stores/model'
import { modelApi, type Model, type ModelForm, type ProviderOption } from '@/api/model'
import VoiceModelTestDrawer from './VoiceModelTestDrawer.vue'

const { t } = useI18n()
const modelStore = useModelStore()
const models = computed(() => modelStore.models)
const modelsLoading = computed(() => modelStore.loading)
const { loadModels, createModel, updateModel, deleteModel } = modelStore

/** 模型类型选项 */
interface ModelTypeOption {
  value: string
  icon: Component
  label: string
  desc: string
}

/** 模型类型点选列表 */
const modelTypeOptions = computed<ModelTypeOption[]>(() => [
  { value: 'llm', icon: ChatDotSquare, label: t('model.llm'), desc: t('model.llmShortDesc') },
  { value: 'embedding', icon: Grid, label: t('model.embedding'), desc: t('model.embeddingShortDesc') },
  { value: 'tts', icon: Headset, label: t('model.tts'), desc: t('model.ttsShortDesc') },
  { value: 'asr', icon: Microphone, label: t('model.asr'), desc: t('model.asrShortDesc') },
  { value: 'image', icon: Picture, label: t('model.image'), desc: t('model.imageShortDesc') },
  { value: 'lmm', icon: Monitor, label: t('model.lmm'), desc: t('model.lmmShortDesc') },
  { value: 's2s', icon: Phone, label: t('model.s2s'), desc: t('model.s2sShortDesc') },
])

/** 提供商选项列表 */
const providerOptions = ref<ProviderOption[]>([])
/** 提供商列表加载状态 */
const providersLoading = ref(false)

const modelDialogVisible = ref(false)
const editingModel = ref<Model | null>(null)
const selectedTags = ref<string[]>([])
const selectedCapabilities = ref<string[]>([])
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
  capabilities: ''
})

/** 语音模型测试 */
const testDrawerVisible = ref(false)
const testModelType = ref<'tts' | 'asr'>('tts')
const testModelCode = ref('')

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
    capabilities: ''
  }
  selectedTags.value = []
  selectedCapabilities.value = []
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
    code: t('model.code'),
    math: t('model.math'),
    creative: t('model.creative'),
    reasoning: t('model.reasoning'),
  }
  return tagMap[tag] || tag
}

/**
 * 获取提供商选项列表
 * @param type 模型类型
 */
const fetchProviders = async (type: string) => {
  providersLoading.value = true
  try {
    const res = await modelApi.getSupportedProviders(type)
    const data = res.data?.data || []
    providerOptions.value = data
    // 如果当前选中的提供商不在列表中，切换为第一个
    if (providerOptions.value.length > 0) {
      const currentProvider = modelForm.value.provider
      const exists = providerOptions.value.some(p => p.value === currentProvider)
      if (!exists) {
        const firstProvider = providerOptions.value[0]
        modelForm.value.provider = firstProvider.value
        modelForm.value.endpoint = firstProvider.defaultBaseUrl
      }
    }
  } catch (error) {
    console.error('获取提供商列表失败', error)
    providerOptions.value = []
  } finally {
    providersLoading.value = false
  }
}

/**
 * 模型类型切换处理
 * @param type 模型类型值
 */
const handleTypeChange = (type: string) => {
  modelForm.value.type = type
  // 切换类型时重新获取支持的提供商列表
  fetchProviders(type)
}

/**
 * 提供商切换处理
 * @param provider 提供商标识
 */
const handleProviderChange = (provider: string) => {
  const selected = providerOptions.value.find(p => p.value === provider)
  if (selected && selected.defaultBaseUrl) {
    modelForm.value.endpoint = selected.defaultBaseUrl
  }
}

/**
 * 获取提供商标识色
 * @param provider 提供商标识
 * @returns 颜色值
 */
const getProviderColor = (provider: string): string => {
  const colors: Record<string, string> = {
    openai: '#10a37f',
    azure: '#0078d4',
    deepseek: '#4d6bfe',
    zhipu: '#5b4dff',
    ollama: '#f5a623',
    aliyun: '#ff6a00',
    tencent: '#0052d9',
    volcengine: '#3370ff',
    custom: '#909399',
  }
  return colors[provider] || '#909399'
}

/**
 * 当前选中提供商的提示信息
 * @returns 提示文本
 */
const currentProviderHint = computed(() => {
  const selected = providerOptions.value.find(p => p.value === modelForm.value.provider)
  if (!selected?.defaultBaseUrl) return ''
  return `默认地址: ${selected.defaultBaseUrl}`
})

/**
 * 解析能力JSON字符串
 * @param capabilities 能力JSON字符串
 * @returns 能力值数组
 */
const getCapabilities = (capabilities?: string): string[] => {
  if (!capabilities) return []
  try {
    return JSON.parse(capabilities)
  } catch {
    return []
  }
}

/**
 * 能力变更处理
 * @param caps 选中的能力值数组
 */
const handleCapabilitiesChange = (caps: string[]) => {
  modelForm.value.capabilities = caps.length > 0 ? JSON.stringify(caps) : ''
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
  // 打开弹窗时获取当前类型的提供商列表
  fetchProviders(modelForm.value.type)
}

/**
 * 编辑模型
 * @param model 模型对象
 */
const handleEditModel = (model: Model) => {
  editingModel.value = model
  modelForm.value = { ...model, apiKey: '' }
  selectedTags.value = parseTags(model.tags)
  selectedCapabilities.value = parseTags(model.capabilities)
  clearApiKey.value = false
  modelDialogVisible.value = true
  // 打开弹窗时获取当前类型的提供商列表
  fetchProviders(model.type)
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

/**
 * 测试语音模型
 * @param model 模型对象
 */
const handleTestModel = (model: Model) => {
  testModelType.value = model.type as 'tts' | 'asr'
  testModelCode.value = model.code
  testDrawerVisible.value = true
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped lang="scss">
// ===================== 分区 =====================
.form-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &.form-section-type {
    border-bottom: none;
    padding-top: 0;
  }

  &.form-section-bottom {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
}

.required-mark {
  color: var(--el-color-danger);
  margin-left: 2px;
}

// ===================== 模型类型卡片 =====================
.model-type-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 14px;
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 0 0 calc((100% - 16px) / 3);
  background: var(--el-fill-color-blank);
  user-select: none;

  &:hover {
    border-color: var(--el-color-primary-light-3);
    background: var(--el-color-primary-light-9);
    transform: translateY(-1px);
  }

  &.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    box-shadow: 0 2px 8px rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.15);

    .model-type-icon {
      color: var(--el-color-primary);
    }

    .model-type-name {
      color: var(--el-color-primary);
    }
  }
}

.model-type-icon {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.model-type-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
  text-align: center;
  line-height: 1.3;
}

.model-type-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

// ===================== 提供商 =====================
.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.field-hint {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

// ===================== API Key =====================
.api-key-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;

  :deep(.el-input) {
    flex: 1;
  }
}
</style>
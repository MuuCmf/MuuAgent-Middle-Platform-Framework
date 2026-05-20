<template>
  <div class="card">
    <div class="card-title">
      {{ $t('model.templateList') }}
      <el-tag type="info" size="small">{{ templates.length }} {{ $t('model.templateCount') }}</el-tag>
    </div>

    <div class="help-tip" style="margin-bottom: 20px;">
      <div class="help-tip-title">💡 {{ $t('model.templateTip') }}</div>
      <ul>
        <li><strong>{{ $t('model.temperatureDesc') }}</strong></li>
        <li><strong>{{ $t('model.topPDesc') }}</strong></li>
        <li><strong>{{ $t('model.contextWindowDesc') }}</strong></li>
        <li><strong>{{ $t('model.maxTokensDesc') }}</strong></li>
      </ul>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px;">
      <el-button type="primary" @click="handleAddTemplate">
        <el-icon>
          <Plus />
        </el-icon>
        {{ $t('model.createTemplate') }}
      </el-button>

      <el-select v-model="filterModelType" :placeholder="$t('model.modelTypeFilter')" clearable style="width: 150px;" @change="loadTemplates">
        <el-option label="LLM" value="llm" />
        <el-option :label="$t('model.embedding')" value="embedding" />
        <el-option :label="$t('model.multimodal')" value="multimodal" />
      </el-select>

      <el-select v-model="filterSceneTag" :placeholder="$t('model.sceneTagFilter')" clearable style="width: 150px;" @change="loadTemplates">
        <el-option :label="$t('model.customerService')" value="customer_service" />
        <el-option :label="$t('model.creativeWriting')" value="creative" />
        <el-option :label="$t('model.vectorGeneration')" value="vector" />
        <el-option :label="$t('model.multimodalGeneration')" value="multimodal" />
        <el-option :label="$t('model.codeGeneration')" value="code" />
      </el-select>
    </div>

    <el-table :data="templates" stripe v-loading="templatesLoading">
      <el-table-column prop="name" :label="$t('model.templateName')" width="180" />
      <el-table-column prop="code" :label="$t('model.templateId')" width="200">
        <template #default="{ row }">
          <el-tag type="info">{{ row.code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="modelType" :label="$t('model.modelType')" width="100">
        <template #default="{ row }">
          <el-tag>{{ getModelTypeLabel(row.modelType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sceneTag" :label="$t('model.sceneTagFilter')" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.sceneTag" type="warning">{{ getSceneTagLabel(row.sceneTag) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('model.paramConfig')" width="280">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag size="small">{{ $t('model.temperature') }}: {{ row.temperature }}</el-tag>
            <el-tag size="small">TopP: {{ row.topP }}</el-tag>
            <el-tag size="small">{{ $t('model.contextWindow') }}: {{ row.contextWindow }}</el-tag>
            <el-tag size="small">{{ $t('model.maxTokens') }}: {{ row.maxTokens }}</el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column prop="isDefault" :label="$t('model.isDefault')" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" type="success">{{ $t('model.isDefault') }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" :label="$t('model.status')" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">
            {{ row.status ? $t('model.enabled') : $t('model.disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.actions')" width="280" fixed="right" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditTemplate(row)">{{ $t('common.edit') }}</el-button>
          <el-button size="small" type="warning" @click="handleCopyTemplate(row.id)">{{ $t('model.copy') }}</el-button>
          <el-button size="small" type="success" @click="handleSetDefaultTemplate(row.id)" :disabled="row.isDefault">
            {{ $t('model.setDefault') }}
          </el-button>
          <el-button size="small" type="danger" @click="handleDeleteTemplate(row.id)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="templateDialogVisible" :title="editingTemplate ? $t('model.editTemplate') : $t('model.createTemplate')" direction="rtl" size="600px"
    class="template-drawer">
    <el-form :model="templateForm" label-width="100px" label-position="top">
      <div class="form-section">
        <div class="form-section-title">
          <el-icon>
            <Document />
          </el-icon>
          {{ $t('model.basicInfo') }}
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('model.templateName')" required>
              <el-input v-model="templateForm.name" :placeholder="$t('model.templateNamePlaceholder')">
                <template #suffix>
                  <el-tooltip :content="$t('model.templateNameTip')" placement="top">
                    <el-icon class="input-tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('model.templateId')" required>
              <el-input v-model="templateForm.code" :placeholder="$t('model.templateIdPlaceholder')">
                <template #suffix>
                  <el-tooltip :content="$t('model.templateIdTip')" placement="top">
                    <el-icon class="input-tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('model.modelType')" required>
              <el-select v-model="templateForm.modelType" style="width: 100%;" :placeholder="$t('model.modelTypeSelectTip')">
                <el-option :label="$t('model.llm')" value="llm">
                  <div class="select-option-content">
                    <span>{{ $t('model.llm') }}</span>
                    <span class="select-option-desc">{{ $t('model.llmDesc') }}</span>
                  </div>
                </el-option>
                <el-option :label="$t('model.embedding')" value="embedding">
                  <div class="select-option-content">
                    <span>{{ $t('model.embedding') }}</span>
                    <span class="select-option-desc">{{ $t('model.embeddingDesc') }}</span>
                  </div>
                </el-option>
                <el-option :label="$t('model.multimodal')" value="multimodal">
                  <div class="select-option-content">
                    <span>{{ $t('model.multimodal') }}</span>
                    <span class="select-option-desc">{{ $t('model.multimodalDesc') }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('model.sceneTagFilter')">
              <el-select v-model="templateForm.sceneTag" style="width: 100%;" clearable :placeholder="$t('model.sceneTagTip')">
                <el-option :label="$t('model.customerServiceDesc')" value="customer_service" />
                <el-option :label="$t('model.creativeWritingDesc')" value="creative" />
                <el-option :label="$t('model.vectorGenerationDesc')" value="vector" />
                <el-option :label="$t('model.multimodalGenerationDesc')" value="multimodal" />
                <el-option :label="$t('model.codeGenerationDesc')" value="code" />
              </el-select>
              <div class="form-item-tip">
                <el-icon>
                  <InfoFilled />
                </el-icon>
                {{ $t('model.sceneTagTip') }}
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="form-section">
        <div class="form-section-title">
          <el-icon>
            <Setting />
          </el-icon>
          {{ $t('model.paramConfig') }}
        </div>

        <div class="param-group">
          <div class="param-group-header">
            <span class="param-group-label">{{ $t('model.temperature') }} (Temperature)</span>
            <el-tag size="small" :type="getTemperatureTagType(templateForm.temperature)">
              {{ getTemperatureDesc(templateForm.temperature) }}
            </el-tag>
          </div>
          <div class="param-group-content">
            <el-slider v-model="templateForm.temperature" :min="0" :max="1" :step="0.1" show-input
              :show-input-controls="false" />
            <div class="param-marks">
              <span>0 ({{ $t('model.preciseMode') }})</span>
              <span>0.3 ({{ $t('model.balancedMode') }})</span>
              <span>0.7 ({{ $t('model.creativeMode') }})</span>
              <span>1 ({{ $t('model.divergentMode') }})</span>
            </div>
            <div class="param-tip">
              <el-icon>
                <InfoFilled />
              </el-icon>
              {{ $t('model.temperatureTip') }}
            </div>
          </div>
        </div>

        <div class="param-group">
          <div class="param-group-header">
            <span class="param-group-label">{{ $t('model.topP') }} (Top-P)</span>
            <el-tag size="small" type="info">{{ $t('model.topPDesc') }}</el-tag>
          </div>
          <div class="param-group-content">
            <el-slider v-model="templateForm.topP" :min="0" :max="1" :step="0.05" show-input
              :show-input-controls="false" />
            <div class="param-marks">
              <span>0</span>
              <span>0.5</span>
              <span>0.7 ({{ $t('common.recommend') }})</span>
              <span>1</span>
            </div>
            <div class="param-tip">
              <el-icon>
                <InfoFilled />
              </el-icon>
              {{ $t('model.topPTip') }}
            </div>
          </div>
        </div>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">
              {{ $t('model.contextWindow') }} (Context Window)
              <el-tooltip :content="$t('model.contextWindowTip')" placement="top">
                <el-icon class="label-tip-icon">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="templateForm.contextWindow" :min="512" :max="128000" :step="1024"
            style="width: 100%;" controls-position="right" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            {{ $t('model.contextWindowExample') }}
          </div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">
              {{ $t('model.maxTokens') }} (Max Tokens)
              <el-tooltip :content="$t('model.maxTokensTip')" placement="top">
                <el-icon class="label-tip-icon">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="templateForm.maxTokens" :min="1" :max="32768" :step="100" style="width: 100%;"
            controls-position="right" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            {{ $t('model.maxTokensExample') }}
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="form-section-title">
          <el-icon>
            <EditPen />
          </el-icon>
          {{ $t('model.templateDesc') }}
        </div>
        <el-form-item :label="$t('model.templateDesc')">
          <el-input v-model="templateForm.description" type="textarea" :rows="2"
            :placeholder="$t('model.templateDescPlaceholder')" show-word-limit maxlength="500" />
        </el-form-item>

        <el-form-item :label="$t('model.remark')">
          <el-input v-model="templateForm.remark" type="textarea" :rows="2" :placeholder="$t('model.remarkPlaceholder')"
            show-word-limit maxlength="500" />
        </el-form-item>

        <el-form-item :label="$t('model.setDefault')">
          <el-switch v-model="templateForm.isDefault" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            {{ $t('model.setDefaultDesc') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('model.enableStatus')">
          <el-switch v-model="templateForm.status" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            {{ $t('model.disableStatusDesc') }}
          </div>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="templateDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveTemplate">{{ $t('common.save') }}</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Document, Setting, EditPen, QuestionFilled, InfoFilled } from '@element-plus/icons-vue'
import { modelTemplateApi } from '@/api/model-template'
import type { ModelTemplate, ModelTemplateForm } from '@/api/model-template'

const { t } = useI18n()
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
    embedding: t('model.embedding'),
    multimodal: t('model.multimodal')
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
    customer_service: t('model.customerService'),
    creative: t('model.creativeWriting'),
    vector: t('model.vectorGeneration'),
    multimodal: t('model.multimodalGeneration'),
    code: t('model.codeGeneration')
  }
  return tagMap[tag] || tag
}

/**
 * 获取温度参数描述
 * @param temperature 温度值
 * @returns 描述文本
 */
const getTemperatureDesc = (temperature: number): string => {
  if (temperature <= 0.2) return t('model.preciseMode')
  if (temperature <= 0.4) return t('model.balancedMode')
  if (temperature <= 0.7) return t('model.creativeMode')
  return t('model.divergentMode')
}

/**
 * 获取温度参数标签类型
 * @param temperature 温度值
 * @returns 标签类型
 */
const getTemperatureTagType = (temperature: number): string => {
  if (temperature <= 0.2) return 'success'
  if (temperature <= 0.4) return 'info'
  if (temperature <= 0.7) return 'warning'
  return 'danger'
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
    ElMessage.error(t('model.loadTemplateListFailed'))
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
    ElMessage.warning(t('model.pleaseFillRequired'))
    return
  }

  try {
    if (editingTemplate.value) {
      await modelTemplateApi.update(editingTemplate.value.id, templateForm.value)
      ElMessage.success(t('model.updateSuccess'))
    } else {
      await modelTemplateApi.create(templateForm.value)
      ElMessage.success(t('model.createSuccess'))
    }
    templateDialogVisible.value = false
    loadTemplates()
  } catch (error: any) {
    console.error('保存失败', error)
    ElMessage.error(error.response?.data?.message || t('model.updateFailed'))
  }
}

/**
 * 删除模板
 * @param id 模板ID
 */
const handleDeleteTemplate = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('model.deleteConfirm'), t('model.deleteTitle'), {
      type: 'warning',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
    await modelTemplateApi.delete(id)
    ElMessage.success(t('model.deleteSuccess'))
    loadTemplates()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败', error)
      ElMessage.error(error.response?.data?.message || t('model.deleteFailed'))
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
    ElMessage.success(t('model.copySuccess'))
    loadTemplates()
  } catch (error: any) {
    console.error('复制失败', error)
    ElMessage.error(error.response?.data?.message || t('model.copyFailed'))
  }
}

/**
 * 设为默认模板
 * @param id 模板ID
 */
const handleSetDefaultTemplate = async (id: string) => {
  try {
    await modelTemplateApi.setDefault(id)
    ElMessage.success(t('model.setDefaultSuccess'))
    loadTemplates()
  } catch (error: any) {
    console.error('设置失败', error)
    ElMessage.error(error.response?.data?.message || t('model.setDefaultFailed'))
  }
}

onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.form-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.form-section-title .el-icon {
  color: #3b82f6;
}

.form-item-tip {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.form-item-tip .el-icon {
  font-size: 14px;
}

.input-tip-icon {
  color: #94a3b8;
  cursor: help;
  transition: color 0.2s;
}

.input-tip-icon:hover {
  color: #3b82f6;
}

.label-with-tip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.label-tip-icon {
  color: #94a3b8;
  cursor: help;
  font-size: 14px;
}

.label-tip-icon:hover {
  color: #3b82f6;
}

.param-group {
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.param-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.param-group-label {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

.param-group-content {
  padding: 0 4px;
}

.param-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.param-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
}

.param-tip .el-icon {
  margin-top: 2px;
  color: #3b82f6;
  flex-shrink: 0;
}

.select-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.select-option-desc {
  font-size: 11px;
  color: #94a3b8;
}

.template-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.template-drawer :deep(.el-drawer__title) {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.template-drawer :deep(.el-drawer__body) {
  padding: 20px;
  overflow-y: auto;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
}

.template-drawer :deep(.el-slider__runway) {
  height: 8px;
}

.template-drawer :deep(.el-slider__bar) {
  height: 8px;
}

.template-drawer :deep(.el-slider__button) {
  width: 18px;
  height: 18px;
}

.template-drawer :deep(.el-input-number) {
  width: 100%;
}

.template-drawer :deep(.el-textarea__inner) {
  resize: none;
}
</style>
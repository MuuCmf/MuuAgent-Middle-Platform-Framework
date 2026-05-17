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
        <el-icon>
          <Plus />
        </el-icon>
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

  <el-drawer v-model="templateDialogVisible" :title="editingTemplate ? '编辑模板' : '新建模板'" direction="rtl" size="600px"
    class="template-drawer">
    <el-form :model="templateForm" label-width="100px" label-position="top">
      <div class="form-section">
        <div class="form-section-title">
          <el-icon>
            <Document />
          </el-icon>
          基本信息
        </div>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="模板名称" required>
              <el-input v-model="templateForm.name" placeholder="如：客服问答模板、创意文案模板">
                <template #suffix>
                  <el-tooltip content="模板的显示名称，便于识别和管理" placement="top">
                    <el-icon class="input-tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模板标识" required>
              <el-input v-model="templateForm.code" placeholder="如：customer-service-template">
                <template #suffix>
                  <el-tooltip content="唯一标识符，用于API调用时指定模板，建议使用英文小写和连字符" placement="top">
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
            <el-form-item label="模型类型" required>
              <el-select v-model="templateForm.modelType" style="width: 100%;" placeholder="选择适配的模型类型">
                <el-option label="LLM (大语言模型)" value="llm">
                  <div class="select-option-content">
                    <span>LLM (大语言模型)</span>
                    <span class="select-option-desc">适用于文本生成、对话问答等场景</span>
                  </div>
                </el-option>
                <el-option label="Embedding (向量模型)" value="embedding">
                  <div class="select-option-content">
                    <span>Embedding (向量模型)</span>
                    <span class="select-option-desc">适用于文本向量化、语义检索等场景</span>
                  </div>
                </el-option>
                <el-option label="Multimodal (多模态)" value="multimodal">
                  <div class="select-option-content">
                    <span>Multimodal (多模态)</span>
                    <span class="select-option-desc">适用于图文理解、多模态生成等场景</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="场景标签">
              <el-select v-model="templateForm.sceneTag" style="width: 100%;" clearable placeholder="选择业务场景">
                <el-option label="客服问答 - 精准简洁输出" value="customer_service" />
                <el-option label="创意文案 - 发散创意输出" value="creative" />
                <el-option label="向量生成 - 一致性向量输出" value="vector" />
                <el-option label="多模态生成 - 图文混合输出" value="multimodal" />
                <el-option label="代码生成 - 规范代码输出" value="code" />
              </el-select>
              <div class="form-item-tip">
                <el-icon>
                  <InfoFilled />
                </el-icon>
                场景标签用于业务场景自动匹配模板
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
          参数配置
        </div>

        <div class="param-group">
          <div class="param-group-header">
            <span class="param-group-label">温度参数 (Temperature)</span>
            <el-tag size="small" :type="getTemperatureTagType(templateForm.temperature)">
              {{ getTemperatureDesc(templateForm.temperature) }}
            </el-tag>
          </div>
          <div class="param-group-content">
            <el-slider v-model="templateForm.temperature" :min="0" :max="1" :step="0.1" show-input
              :show-input-controls="false" />
            <div class="param-marks">
              <span>0 (精准)</span>
              <span>0.3 (平衡)</span>
              <span>0.7 (创意)</span>
              <span>1 (随机)</span>
            </div>
            <div class="param-tip">
              <el-icon>
                <InfoFilled />
              </el-icon>
              控制输出随机性。<strong>低值(0-0.3)</strong>适合客服、代码等需要精准答案的场景；<strong>高值(0.7-1)</strong>适合创意写作、头脑风暴等场景
            </div>
          </div>
        </div>

        <div class="param-group">
          <div class="param-group-header">
            <span class="param-group-label">核采样参数 (Top-P)</span>
            <el-tag size="small" type="info">通常固定 0.7-0.9</el-tag>
          </div>
          <div class="param-group-content">
            <el-slider v-model="templateForm.topP" :min="0" :max="1" :step="0.05" show-input
              :show-input-controls="false" />
            <div class="param-marks">
              <span>0</span>
              <span>0.5</span>
              <span>0.7 (推荐)</span>
              <span>1</span>
            </div>
            <div class="param-tip">
              <el-icon>
                <InfoFilled />
              </el-icon>
              控制输出多样性，从累积概率达到P的候选词中采样。一般与温度参数二选一调整，<strong>推荐保持0.7-0.9</strong>
            </div>
          </div>
        </div>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">
              上下文窗口 (Context Window)
              <el-tooltip content="模型可处理的最大输入Token数，包括系统提示、历史对话和用户输入" placement="top">
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
            常用值：8192 (GPT-3.5)、32768 (GPT-4)、128000 (GPT-4-Turbo)
          </div>
        </el-form-item>


        <el-form-item>
          <template #label>
            <span class="label-with-tip">
              最大生成长度 (Max Tokens)
              <el-tooltip content="模型单次输出的最大Token数，影响响应长度和成本" placement="top">
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
            客服建议200-500，创意建议1000-2000，代码建议500-1000
          </div>
        </el-form-item>


      </div>

      <div class="form-section">
        <div class="form-section-title">
          <el-icon>
            <EditPen />
          </el-icon>
          描述与状态
        </div>
        <el-form-item label="模板描述">
          <el-input v-model="templateForm.description" type="textarea" :rows="2"
            placeholder="描述模板的用途、适用场景、参数特点等，如：适用于企业客服场景，输出精准简洁，贴合标准答案" show-word-limit maxlength="500" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="templateForm.remark" type="textarea" :rows="2" placeholder="其他补充说明，如适用的模型品牌、注意事项等"
            show-word-limit maxlength="500" />
        </el-form-item>


        <el-form-item label="设为默认">
          <el-switch v-model="templateForm.isDefault" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            设为默认后，该模型类型将优先使用此模板
          </div>
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="templateForm.status" />
          <div class="form-item-tip">
            <el-icon>
              <InfoFilled />
            </el-icon>
            禁用后，该模板不会被系统调用
          </div>
        </el-form-item>

      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTemplate">保存</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Document, Setting, EditPen, QuestionFilled, InfoFilled } from '@element-plus/icons-vue'
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
 * 获取温度参数描述
 * @param temperature 温度值
 * @returns 描述文本
 */
const getTemperatureDesc = (temperature: number): string => {
  if (temperature <= 0.2) return '精准模式'
  if (temperature <= 0.4) return '平衡模式'
  if (temperature <= 0.7) return '创意模式'
  return '发散模式'
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
<template>
  <el-drawer
    :model-value="visible"
    :title="editingAgent ? '编辑智能体' : '创建智能体'"
    direction="rtl"
    size="600px"
    class="agent-edit-drawer"
    @update:model-value="handleClose"
  >
    <el-form :model="form" :rules="rules" label-width="100px" ref="formRef" class="agent-form">
      <div class="form-section">
        <div class="section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" prop="name" required>
              <el-input v-model="form.name" placeholder="如：天气助手" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标识" prop="code" required>
              <el-input v-model="form.code" placeholder="如：weather_assistant" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16" v-if="isSuperAdmin">
          <el-col :span="12">
            <el-form-item label="所属应用">
              <AppSelector
                v-model="form.appCode"
                placeholder="选择应用"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公开状态">
              <el-switch
                v-model="form.isPublic"
                active-text="公开"
                inactive-text="私有"
              />
              <div class="field-tip">公开的资源可被其他应用访问</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="系统提示词" prop="systemPrompt" required>
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="4"
            placeholder="定义智能体的角色和行为方式"
          />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">推理配置</div>
        <el-form-item label="推理模式">
          <el-select v-model="form.reasoningMode" placeholder="请选择推理模式" class="w-full">
            <el-option label="默认模式" value="NONE">
              <span>默认模式</span>
              <span class="option-desc">直接调用，响应快</span>
            </el-option>
            <el-option label="ReAct模式" value="REACT">
              <span>ReAct模式</span>
              <span class="option-desc">思考-行动-观察</span>
            </el-option>
            <el-option label="Plan模式" value="PLAN">
              <span>Plan模式</span>
              <span class="option-desc">先规划再执行</span>
            </el-option>
            <el-option label="Reflect模式" value="REFLECT">
              <span>Reflect模式</span>
              <span class="option-desc">执行后反思优化</span>
            </el-option>
          </el-select>
          <div class="mode-tip" v-if="form.reasoningMode">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ reasoningModeTip }}</span>
          </div>
        </el-form-item>

        <el-form-item 
          v-if="form.reasoningMode && form.reasoningMode !== 'NONE'" 
          label="推理提示词"
        >
          <div class="prompt-wrapper">
            <div class="prompt-mode-switch">
              <el-radio-group v-model="promptMode" size="small">
                <el-radio-button value="template">使用模板</el-radio-button>
                <el-radio-button value="custom">自定义输入</el-radio-button>
              </el-radio-group>
            </div>

            <div v-if="promptMode === 'template'" class="template-selector">
              <el-select
                v-model="selectedTemplateCode"
                placeholder="选择提示词模板"
                @change="handleTemplateChange"
                class="w-full"
              >
                <el-option
                  v-for="template in promptTemplates"
                  :key="template.code"
                  :label="template.name"
                  :value="template.code"
                >
                  <div class="template-option">
                    <span>{{ template.name }}</span>
                    <el-tag size="small" type="info">{{ template.category }}</el-tag>
                  </div>
                </el-option>
              </el-select>

              <div v-if="selectedTemplate" class="template-preview">
                <div class="preview-header">
                  <span>模板预览</span>
                  <el-button size="small" text @click="showTemplateDetail = true">
                    查看详情
                  </el-button>
                </div>
                <el-input
                  :model-value="selectedTemplate.content"
                  type="textarea"
                  :rows="6"
                  readonly
                />
              </div>
            </div>

            <el-input
              v-else
              v-model="form.reasoningPrompt"
              type="textarea"
              :rows="4"
              placeholder="可选：自定义推理提示词，留空使用默认模板"
            />

            <div class="prompt-help">
              <div class="help-title">可用占位符：</div>
              <div class="help-items">
                <span class="help-item"><code>{TOOLS}</code> 可用工具列表</span>
                <span class="help-item"><code>{TOOL_NAMES}</code> 工具名称列表</span>
              </div>
              <el-collapse class="help-collapse">
                <el-collapse-item title="查看示例模板">
                  <pre class="example-code">你是一个智能助手，可以使用以下工具：
{TOOLS}

请按照以下格式思考和回答：
Thought: 分析用户问题
Action: 工具名称
Action Input: 工具参数
Observation: 观察结果
Final Answer: 最终答案</pre>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">能力绑定</div>
        <el-form-item label="技能" prop="skills">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleSelectSkills">
              <el-icon><Plus /></el-icon>
              选择技能
            </el-button>
            <div class="bind-content">
              <div v-if="selectedSkillCodes.length === 0" class="empty-tip">
                <el-icon><Warning /></el-icon>
                <span>暂未绑定技能</span>
              </div>
              <div v-else class="tag-list">
                <el-tag
                  v-for="code in selectedSkillCodes"
                  :key="code"
                  closable
                  @close="removeSkill(code)"
                >
                  {{ getSkillName(code) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="知识库" prop="knowledgeBases">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleSelectKbs">
              <el-icon><Plus /></el-icon>
              选择知识库
            </el-button>
            <div class="bind-content">
              <div v-if="selectedKbCodes.length === 0" class="empty-tip">
                <el-icon><Warning /></el-icon>
                <span>暂未绑定知识库</span>
              </div>
              <div v-else class="tag-list">
                <el-tag
                  v-for="code in selectedKbCodes"
                  :key="code"
                  closable
                  type="success"
                  @close="removeKb(code)"
                >
                  {{ getKbName(code) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="MCP Server" prop="mcpServers">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleAddMcpServer">
              <el-icon><Plus /></el-icon>
              添加 Server
            </el-button>
            <div class="bind-content">
              <div v-if="mcpServers.length === 0" class="empty-tip">
                <el-icon><Warning /></el-icon>
                <span>暂未绑定 MCP Server</span>
              </div>
              <div v-else class="mcp-list">
                <McpServerCard
                  v-for="(config, index) in mcpServers"
                  :key="index"
                  :config="config"
                  @delete="handleDeleteMcpServer(index)"
                  @edit="handleEditMcpServer(index)"
                />
              </div>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">高级设置</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大步数">
              <el-input-number v-model="form.maxSteps" :min="1" :max="20" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="温度">
              <el-input-number v-model="form.temperature" :min="0" :max="1" :step="0.1" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </div>
    </template>

    <McpServerConfigDialog
      v-model="mcpServerDialogVisible"
      :config="editingMcpServerIndex !== null ? mcpServers[editingMcpServerIndex] : null"
      @save="handleMcpServerSave"
    />

    <SkillSelectDialog
      v-model="skillSelectDialogVisible"
      :skills="availableSkills"
      :selected-codes="selectedSkillCodes"
      @confirm="handleSkillSelect"
    />

    <KbSelectDialog
      v-model="kbSelectDialogVisible"
      :selected-codes="selectedKbCodes"
      @confirm="handleKbSelect"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, InfoFilled, Warning } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { Agent, AgentForm } from '@/api/agent'
import type { McpServerConfig } from '@/api/mcp-server'
import type { Skill } from '@/api/skill'
import type { KbInfo } from '@/api/kb'
import type { PromptTemplate } from '@/api/prompt-template'
import { kbApi } from '@/api/kb'
import { promptTemplateApi } from '@/api/prompt-template'
import { useUserStore } from '@/stores/user'
import McpServerConfigDialog from './McpServerConfigDialog.vue'
import McpServerCard from './McpServerCard.vue'
import SkillSelectDialog from './SkillSelectDialog.vue'
import KbSelectDialog from './KbSelectDialog.vue'
import AppSelector from '@/components/AppSelector.vue'

interface Props {
  visible: boolean
  agent?: Agent | null
  availableSkills?: Skill[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: AgentForm): Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  agent: null,
  availableSkills: () => []
})

const emit = defineEmits<Emits>()

const userStore = useUserStore()
const formRef = ref<FormInstance>()
const saving = ref(false)

const isSuperAdmin = computed(() => userStore.isSuperAdmin)

const form = ref<AgentForm>({
  name: '',
  code: '',
  systemPrompt: '',
  skills: '[]',
  mcpServers: '[]',
  knowledgeBases: '[]',
  maxSteps: 5,
  temperature: 0.7,
  status: true,
  reasoningMode: 'NONE',
  reasoningPrompt: '',
  kbRetrievalMode: 'tool',
  appCode: '',
  isPublic: false,
})

const editingAgent = computed(() => props.agent)

const mcpServerDialogVisible = ref(false)
const editingMcpServerIndex = ref<number | null>(null)
const mcpServers = ref<McpServerConfig[]>([])

const skillSelectDialogVisible = ref(false)
const selectedSkillCodes = ref<string[]>([])

const kbSelectDialogVisible = ref(false)
const selectedKbCodes = ref<string[]>([])
const availableKbs = ref<KbInfo[]>([])

const promptMode = ref<'template' | 'custom'>('template')
const promptTemplates = ref<PromptTemplate[]>([])
const selectedTemplateCode = ref<string>('')
const selectedTemplate = ref<PromptTemplate | null>(null)
const showTemplateDetail = ref(false)

const reasoningModeTip = computed(() => {
  const tips: Record<string, string> = {
    NONE: '直接工具调用，适合简单任务，响应最快',
    REACT: '思考-行动-观察循环，适合复杂推理场景',
    PLAN: '先规划再执行，适合多步骤任务',
    REFLECT: '执行后反思优化，适合需要质量保证的任务'
  }
  const mode = form.value.reasoningMode
  return mode ? tips[mode] || '' : ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入智能体名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入智能体标识', trigger: 'blur' }],
  systemPrompt: [{ required: true, message: '请输入系统提示词', trigger: 'blur' }]
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (editingAgent.value) {
      form.value = {
        ...editingAgent.value,
        skills: Array.isArray(editingAgent.value.skills) 
          ? JSON.stringify(editingAgent.value.skills) 
          : editingAgent.value.skills,
        mcpServers: editingAgent.value.mcpServers || '[]',
        knowledgeBases: editingAgent.value.knowledgeBases || '[]',
        appCode: editingAgent.value.appCode || '',
        isPublic: editingAgent.value.isPublic ?? false,
      }
      mcpServers.value = parseJsonSafe(editingAgent.value.mcpServers || '[]')
      selectedSkillCodes.value = parseJsonSafe(editingAgent.value.skills || '[]')
      selectedKbCodes.value = parseJsonSafe(editingAgent.value.knowledgeBases || '[]')
      
      if (editingAgent.value.reasoningPrompt) {
        promptMode.value = 'template'
        selectedTemplateCode.value = editingAgent.value.reasoningPrompt
        const template = promptTemplates.value.find(t => t.code === editingAgent.value!.reasoningPrompt)
        if (template) {
          selectedTemplate.value = template
        }
      }
    } else {
      resetForm()
    }
    loadKbs()
    loadPromptTemplates()
  }
})

const parseJsonSafe = (str: string, defaultValue: any[] = []) => {
  if (!str) return defaultValue
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    systemPrompt: '',
    skills: '[]',
    mcpServers: '[]',
    knowledgeBases: '[]',
    maxSteps: 5,
    temperature: 0.7,
    status: true,
    reasoningMode: 'NONE',
    reasoningPrompt: '',
    kbRetrievalMode: 'tool',
    appCode: '',
    isPublic: false,
  }
  mcpServers.value = []
  selectedSkillCodes.value = []
  selectedKbCodes.value = []
  promptMode.value = 'template'
  selectedTemplateCode.value = ''
  selectedTemplate.value = null
  formRef.value?.resetFields()
}

const loadKbs = async () => {
  try {
    const response = await kbApi.getList({ pageSize: 100, status: true })
    if (response.data.code === 200) {
      availableKbs.value = response.data.data.list
    }
  } catch (error) {
    console.error('加载知识库列表失败', error)
  }
}

const loadPromptTemplates = async () => {
  try {
    const response = await promptTemplateApi.findAll({ 
      pageSize: 100, 
      status: true,
      category: 'react'
    })
    if (response.data.code === 200) {
      promptTemplates.value = response.data.data.list
    }
  } catch (error) {
    console.error('加载提示词模板列表失败', error)
  }
}

const handleTemplateChange = (code: string) => {
  const template = promptTemplates.value.find(t => t.code === code)
  if (template) {
    selectedTemplate.value = template
    form.value.reasoningPrompt = template.code
  } else {
    selectedTemplate.value = null
    form.value.reasoningPrompt = ''
  }
}

const getSkillName = (code: string) => {
  const skill = props.availableSkills.find(s => s.code === code)
  return skill?.name || code
}

const getKbName = (code: string) => {
  const kb = availableKbs.value.find(k => k.kbCode === code)
  return kb?.kbName || code
}

const handleSelectSkills = () => {
  skillSelectDialogVisible.value = true
}

const handleSkillSelect = (codes: string[]) => {
  selectedSkillCodes.value = codes
  form.value.skills = JSON.stringify(codes)
}

const removeSkill = (code: string) => {
  const index = selectedSkillCodes.value.indexOf(code)
  if (index > -1) {
    selectedSkillCodes.value.splice(index, 1)
    form.value.skills = JSON.stringify(selectedSkillCodes.value)
  }
}

const handleSelectKbs = () => {
  kbSelectDialogVisible.value = true
}

const handleKbSelect = (codes: string[]) => {
  selectedKbCodes.value = codes
  form.value.knowledgeBases = JSON.stringify(codes)
}

const removeKb = (code: string) => {
  const index = selectedKbCodes.value.indexOf(code)
  if (index > -1) {
    selectedKbCodes.value.splice(index, 1)
    form.value.knowledgeBases = JSON.stringify(selectedKbCodes.value)
  }
}

const handleAddMcpServer = () => {
  editingMcpServerIndex.value = null
  mcpServerDialogVisible.value = true
}

const handleEditMcpServer = (index: number) => {
  editingMcpServerIndex.value = index
  mcpServerDialogVisible.value = true
}

const handleDeleteMcpServer = (index: number) => {
  mcpServers.value.splice(index, 1)
  ElMessage.success('已删除 MCP Server')
}

const handleMcpServerSave = (config: McpServerConfig) => {
  if (editingMcpServerIndex.value !== null) {
    mcpServers.value[editingMcpServerIndex.value] = config
    ElMessage.success('MCP Server 配置已更新')
  } else {
    mcpServers.value.push(config)
    ElMessage.success('MCP Server 已添加')
  }
}

const handleSave = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        JSON.parse(form.value.skills)
      } catch {
        ElMessage.warning('技能列表格式错误')
        return
      }

      form.value.mcpServers = JSON.stringify(mcpServers.value)

      saving.value = true
      try {
        await emit('save', form.value)
        ElMessage.success(editingAgent.value ? '更新成功' : '创建成功')
        handleClose()
      } catch (error) {
        console.error('保存失败', error)
      } finally {
        saving.value = false
      }
    }
  })
}

const handleClose = () => {
  emit('update:visible', false)
  resetForm()
}
</script>

<style lang="scss" scoped>
.agent-form {
  padding: 0 16px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;

  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}

.w-full {
  width: 100%;
}

.mode-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;

  .el-icon {
    font-size: 14px;
  }
}

.option-desc {
  float: right;
  font-size: 12px;
  color: #909399;
}

.prompt-wrapper {
  width: 100%;
}

.prompt-mode-switch {
  margin-bottom: 12px;
}

.template-selector {
  margin-bottom: 12px;
}

.template-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.template-preview {
  margin-top: 12px;
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #606266;
  }
}

.prompt-help {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.help-title {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 6px;
}

.help-items {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.help-item {
  font-size: 12px;
  color: #909399;

  code {
    padding: 1px 4px;
    background: #e9ecef;
    border-radius: 3px;
    font-family: monospace;
    color: #e6a23c;
  }
}

.help-collapse {
  margin-top: 8px;
  border: none;
  background: transparent;

  :deep(.el-collapse-item__header) {
    height: 28px;
    line-height: 28px;
    font-size: 12px;
    color: #409eff;
    background: transparent;
    border: none;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
  }

  :deep(.el-collapse-item__content) {
    padding: 0;
  }
}

.example-code {
  margin: 8px 0 0 0;
  padding: 10px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.6;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
}

.bind-wrapper {
  width: 100%;
}

.bind-content {
  margin-top: 12px;
}

.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  color: #909399;
  font-size: 13px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.mcp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

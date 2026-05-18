<template>
  <el-drawer :model-value="visible" :title="editingAgent ? '编辑智能体' : '创建智能体'" direction="rtl" size="600px"
    class="agent-edit-drawer" @update:model-value="handleClose">
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

        <el-form-item label="所属应用">
          <AppSelector v-model="form.appCode" placeholder="选择应用" clearable />
        </el-form-item>

        <el-form-item label="公开状态">
          <el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有" />
          <div class="field-tip">公开的资源可被其他应用访问</div>
        </el-form-item>

        <el-form-item label="系统提示词" prop="systemPrompt" required>
          <el-input v-model="form.systemPrompt" type="textarea" :rows="4" placeholder="定义智能体的角色和行为方式" />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">模型参数配置</div>
        <div class="section-desc">配置智能体调用模型时的参数，自定义参数优先级高于模板参数</div>

        <div class="model-call-guide">
          <div class="guide-header">
            <el-icon><InfoFilled /></el-icon>
            <span>模型调用机制</span>
          </div>
          <div class="guide-content">
            <div class="guide-item">
              <span class="guide-label">调用流程</span>
              <span class="guide-value">用户输入 → 智能体获取 → 意图识别 → 模型路由调度 → 参数合并 → 模型推理 → 返回结果</span>
            </div>
            <div class="guide-item">
              <span class="guide-label">上下文管理</span>
              <span class="guide-value">系统自动管理对话历史，根据上下文窗口参数截断超长对话</span>
            </div>
          </div>
        </div>

        <el-form-item label="模型模板">
          <el-select v-model="form.modelTemplateCode" placeholder="选择模型模板" clearable class="w-full" @change="handleModelTemplateChange">
            <el-option v-for="template in modelTemplates" :key="template.code" :label="template.name" :value="template.code">
              <div class="template-option">
                <span>{{ template.name }}</span>
                <el-tag size="small" type="info">{{ template.sceneTag || '通用' }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <div v-if="selectedModelTemplate" class="template-info-card">
          <div class="info-card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>模板参数预览</span>
          </div>
          <div class="info-card-body">
            <div class="param-item">
              <span class="param-label">温度</span>
              <span class="param-value">{{ selectedModelTemplate.temperature }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">TopP</span>
              <span class="param-value">{{ selectedModelTemplate.topP }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">最大Token</span>
              <span class="param-value">{{ selectedModelTemplate.maxTokens }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">上下文窗口</span>
              <span class="param-value">{{ selectedModelTemplate.contextWindow }}</span>
            </div>
          </div>
        </div>

        <el-form-item label="自定义参数">
          <el-switch v-model="enableCustomParams" active-text="启用" inactive-text="禁用" />
        </el-form-item>

        <template v-if="enableCustomParams">
          <div class="preset-quick-select">
            <span class="preset-label">快捷预设：</span>
            <el-button-group>
              <el-button size="small" :type="currentPreset === 'precise' ? 'primary' : 'default'" @click="applyPreset('precise')">
                精确模式
              </el-button>
              <el-button size="small" :type="currentPreset === 'balanced' ? 'primary' : 'default'" @click="applyPreset('balanced')">
                平衡模式
              </el-button>
              <el-button size="small" :type="currentPreset === 'creative' ? 'primary' : 'default'" @click="applyPreset('creative')">
                创意模式
              </el-button>
            </el-button-group>
          </div>

          <div class="custom-params-card">
            <div class="param-config-item">
              <div class="param-header">
                <span class="param-name">温度参数 (Temperature)</span>
                <el-tag size="small" :type="getTemperatureTagType(customParams.temperature)">
                  {{ getTemperatureLabel(customParams.temperature) }}
                </el-tag>
              </div>
              <el-slider 
                v-model="customParams.temperature" 
                :min="0" 
                :max="1" 
                :step="0.1" 
                :marks="temperatureMarks"
                class="param-slider"
              />
              <div class="param-desc">
                <span v-if="customParams.temperature < 0.3">精确输出，适合事实性问答</span>
                <span v-else-if="customParams.temperature < 0.7">平衡输出，适合通用场景</span>
                <span v-else>创意输出，适合创意写作</span>
              </div>
            </div>

            <div class="param-config-item">
              <div class="param-header">
                <span class="param-name">核采样参数 (TopP)</span>
                <el-tag size="small" type="info">{{ customParams.topP }}</el-tag>
              </div>
              <el-slider 
                v-model="customParams.topP" 
                :min="0" 
                :max="1" 
                :step="0.05"
                :marks="topPMarks"
                class="param-slider"
              />
              <div class="param-desc">控制输出多样性，值越大生成的文本越多样</div>
            </div>

            <el-row :gutter="16">
              <el-col :span="12">
                <div class="param-config-item compact">
                  <div class="param-header">
                    <span class="param-name">最大生成长度</span>
                  </div>
                  <el-input-number 
                    v-model="customParams.maxTokens" 
                    :min="256" 
                    :max="128000" 
                    :step="256" 
                    class="w-full"
                    controls-position="right"
                  />
                  <div class="param-desc">模型单次生成的最大Token数</div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="param-config-item compact">
                  <div class="param-header">
                    <span class="param-name">上下文窗口</span>
                  </div>
                  <el-input-number 
                    v-model="customParams.contextWindow" 
                    :min="1024" 
                    :max="128000" 
                    :step="1024" 
                    class="w-full"
                    controls-position="right"
                  />
                  <div class="param-desc">模型可处理的上下文长度</div>
                </div>
              </el-col>
            </el-row>
          </div>

          <div v-if="selectedModelTemplate" class="params-compare">
            <div class="compare-title">
              <el-icon><Warning /></el-icon>
              <span>参数对比</span>
            </div>
            <div class="compare-table">
              <div class="compare-row header">
                <span class="compare-cell">参数</span>
                <span class="compare-cell">模板值</span>
                <span class="compare-cell">自定义值</span>
                <span class="compare-cell">差异</span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">温度</span>
                <span class="compare-cell">{{ selectedModelTemplate.temperature }}</span>
                <span class="compare-cell highlight">{{ customParams.temperature }}</span>
                <span class="compare-cell" :class="getDiffClass(customParams.temperature - selectedModelTemplate.temperature)">
                  {{ formatDiff(customParams.temperature - selectedModelTemplate.temperature) }}
                </span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">TopP</span>
                <span class="compare-cell">{{ selectedModelTemplate.topP }}</span>
                <span class="compare-cell highlight">{{ customParams.topP }}</span>
                <span class="compare-cell" :class="getDiffClass(customParams.topP - selectedModelTemplate.topP)">
                  {{ formatDiff(customParams.topP - selectedModelTemplate.topP) }}
                </span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">最大Token</span>
                <span class="compare-cell">{{ selectedModelTemplate.maxTokens }}</span>
                <span class="compare-cell highlight">{{ customParams.maxTokens }}</span>
                <span class="compare-cell" :class="getDiffClass(customParams.maxTokens - selectedModelTemplate.maxTokens)">
                  {{ formatDiff(customParams.maxTokens - selectedModelTemplate.maxTokens) }}
                </span>
              </div>
            </div>
          </div>
        </template>
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
            <el-icon>
              <InfoFilled />
            </el-icon>
            <span>{{ reasoningModeTip }}</span>
          </div>
        </el-form-item>

        <el-form-item v-if="form.reasoningMode && form.reasoningMode !== 'NONE'" label="推理提示词">
          <div class="prompt-wrapper">
            <div class="prompt-mode-switch">
              <el-radio-group v-model="promptMode" size="small">
                <el-radio-button value="template">使用模板</el-radio-button>
                <el-radio-button value="custom">自定义输入</el-radio-button>
              </el-radio-group>
            </div>

            <div v-if="promptMode === 'template'" class="template-selector">
              <el-select v-model="selectedTemplateCode" placeholder="选择提示词模板" @change="handleTemplateChange"
                class="w-full">
                <el-option v-for="template in promptTemplates" :key="template.code" :label="template.name"
                  :value="template.code">
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
                <el-input :model-value="selectedTemplate.content" type="textarea" :rows="6" readonly />
              </div>
            </div>

            <el-input v-else v-model="form.reasoningPrompt" type="textarea" :rows="4"
              placeholder="可选：自定义推理提示词，留空使用默认模板" />

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
              <el-icon>
                <Plus />
              </el-icon>
              选择技能
            </el-button>
            <div class="bind-content">
              <div v-if="selectedSkillCodes.length === 0" class="empty-tip">
                <el-icon>
                  <Warning />
                </el-icon>
                <span>暂未绑定技能</span>
              </div>
              <div v-else class="tag-list">
                <el-tag v-for="code in selectedSkillCodes" :key="code" closable @close="removeSkill(code)">
                  {{ getSkillName(code) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="知识库" prop="knowledgeBases">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleSelectKbs">
              <el-icon>
                <Plus />
              </el-icon>
              选择知识库
            </el-button>
            <div class="bind-content">
              <div v-if="selectedKbCodes.length === 0" class="empty-tip">
                <el-icon>
                  <Warning />
                </el-icon>
                <span>暂未绑定知识库</span>
              </div>
              <div v-else class="tag-list">
                <el-tag v-for="code in selectedKbCodes" :key="code" closable type="success" @close="removeKb(code)">
                  {{ getKbName(code) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="MCP Server" prop="mcpServers">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleAddMcpServer">
              <el-icon>
                <Plus />
              </el-icon>
              添加 Server
            </el-button>
            <div class="bind-content">
              <div v-if="mcpServers.length === 0" class="empty-tip">
                <el-icon>
                  <Warning />
                </el-icon>
                <span>暂未绑定 MCP Server</span>
              </div>
              <div v-else class="mcp-list">
                <McpServerCard v-for="(config, index) in mcpServers" :key="index" :config="config"
                  @delete="handleDeleteMcpServer(index)" @edit="handleEditMcpServer(index)" />
              </div>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">工作目录</div>
        <div class="section-desc">允许智能体在用户选择的工作目录中进行文件操作</div>

        <el-form-item label="启用工作目录">
          <el-switch v-model="form.workspaceConfig.enabled" active-text="启用" inactive-text="禁用" />

        </el-form-item>

        <template v-if="form.workspaceConfig.enabled">
          <el-form-item label="允许的操作">
            <el-checkbox-group v-model="form.workspaceConfig.allowedOperations">
              <el-checkbox value="read_file">读取文件</el-checkbox>
              <el-checkbox value="read_dir">列出目录</el-checkbox>
              <el-checkbox value="write_file">写入文件</el-checkbox>
              <el-checkbox value="append_file">追加文件</el-checkbox>
              <el-checkbox value="create_dir">创建目录</el-checkbox>
              <el-checkbox value="delete_file">删除文件</el-checkbox>
            </el-checkbox-group>
            <div class="field-tip">留空表示允许全部操作</div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="文件大小限制">
                <el-input-number v-model="form.workspaceConfig.maxFileSize" :min="1" :max="10240" :step="100"
                  class="w-full" />
                <div class="field-tip">默认 1024KB（1MB）</div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-form-item label="禁止的文件后缀">
              <el-input v-model="deniedExtensionsStr" placeholder=".exe,.bat,.sh"
                @change="handleDeniedExtensionsChange" />
              <div class="field-tip">逗号分隔，默认：.exe,.bat,.sh,.cmd,.js,.vbs</div>
            </el-form-item>
          </el-row>
        </template>
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
            <el-form-item label="状态">
              <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </div>
    </template>

    <McpServerConfigDialog v-model="mcpServerDialogVisible"
      :config="editingMcpServerIndex !== null ? mcpServers[editingMcpServerIndex] : null" @save="handleMcpServerSave" />

    <SkillSelectDialog v-model="skillSelectDialogVisible" :skills="availableSkills" :selected-codes="selectedSkillCodes"
      @confirm="handleSkillSelect" />

    <KbSelectDialog v-model="kbSelectDialogVisible" :selected-codes="selectedKbCodes" @confirm="handleKbSelect" />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, InfoFilled, Warning } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { Agent, AgentForm, WorkspaceAgentConfig, CustomModelParams } from '@/api/agent'

interface InternalCustomModelParams {
  temperature: number
  topP: number
  maxTokens: number
  contextWindow: number
}
import type { McpServerConfig } from '@/api/mcp-server'
import type { StandardSkill } from '@/api/skill'
import type { KbInfo } from '@/api/kb'
import type { PromptTemplate } from '@/api/prompt-template'
import type { ModelTemplate } from '@/api/model-template'
import { kbApi } from '@/api/kb'
import { promptTemplateApi } from '@/api/prompt-template'
import { modelTemplateApi } from '@/api/model-template'
import { useUserStore } from '@/stores/user'
import McpServerConfigDialog from './McpServerConfigDialog.vue'
import McpServerCard from './McpServerCard.vue'
import SkillSelectDialog from './SkillSelectDialog.vue'
import KbSelectDialog from './KbSelectDialog.vue'
import AppSelector from '@/components/AppSelector.vue'

interface Props {
  visible: boolean
  agent?: Agent | null
  availableSkills?: StandardSkill[]
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
  status: true,
  modelTemplateCode: '',
  customModelParams: '',
  reasoningMode: 'NONE',
  reasoningPrompt: '',
  kbRetrievalMode: 'tool',
  workspaceConfig: {
    enabled: false,
    allowedOperations: [],
    maxFileSize: 1024,
    deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
  },
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

const deniedExtensionsStr = ref('.exe,.bat,.sh,.cmd,.js,.vbs')

const modelTemplates = ref<ModelTemplate[]>([])
const selectedModelTemplate = ref<ModelTemplate | null>(null)
const enableCustomParams = ref(false)
const customParams = ref<InternalCustomModelParams>({
  temperature: 0.7,
  topP: 0.7,
  maxTokens: 4096,
  contextWindow: 8192,
})

const currentPreset = ref<string>('')

const temperatureMarks = {
  0: '精确',
  0.3: '标准',
  0.7: '创意',
  1: '随机'
}

const topPMarks = {
  0: '0',
  0.5: '0.5',
  1: '1'
}

const presetConfigs = {
  precise: { temperature: 0.1, topP: 0.5, maxTokens: 2048, contextWindow: 4096 },
  balanced: { temperature: 0.5, topP: 0.7, maxTokens: 4096, contextWindow: 8192 },
  creative: { temperature: 0.9, topP: 0.9, maxTokens: 8192, contextWindow: 16384 }
}

const applyPreset = (preset: string) => {
  currentPreset.value = preset
  const config = presetConfigs[preset as keyof typeof presetConfigs]
  if (config) {
    customParams.value = { ...config }
  }
}

const getTemperatureTagType = (value: number | undefined): string => {
  if (value === undefined) return 'info'
  if (value < 0.3) return 'success'
  if (value < 0.7) return 'warning'
  return 'danger'
}

const getTemperatureLabel = (value: number | undefined): string => {
  if (value === undefined) return '未设置'
  if (value < 0.3) return '精确'
  if (value < 0.7) return '平衡'
  return '创意'
}

const getDiffClass = (diff: number): string => {
  if (diff > 0) return 'diff-up'
  if (diff < 0) return 'diff-down'
  return 'diff-same'
}

const formatDiff = (diff: number): string => {
  if (diff === 0) return '-'
  const prefix = diff > 0 ? '+' : ''
  return `${prefix}${diff.toFixed(diff % 1 === 0 ? 0 : 2)}`
}

const handleDeniedExtensionsChange = () => {
  if (form.value.workspaceConfig) {
    form.value.workspaceConfig.deniedExtensions = deniedExtensionsStr.value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.startsWith('.'))
  }
}
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
        workspaceConfig: {
          enabled: false,
          allowedOperations: [],
          maxFileSize: 1024,
          deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
        },
      }
      mcpServers.value = parseJsonSafe(editingAgent.value.mcpServers || '[]')
      selectedSkillCodes.value = parseJsonSafe(editingAgent.value.skills || '[]')
      selectedKbCodes.value = parseJsonSafe(editingAgent.value.knowledgeBases || '[]')

      // 解析 workspaceConfig
      const rawConfig = editingAgent.value.workspaceConfig
      const defaultDenied = ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs']
      if (rawConfig) {
        const config: WorkspaceAgentConfig = typeof rawConfig === 'string'
          ? JSON.parse(rawConfig)
          : rawConfig
        form.value.workspaceConfig = {
          enabled: config.enabled ?? false,
          allowedOperations: config.allowedOperations || [],
          maxFileSize: config.maxFileSize ?? 1024,
          deniedExtensions: config.deniedExtensions || defaultDenied,
        }
        deniedExtensionsStr.value = (config.deniedExtensions || defaultDenied).join(',')
      } else {
        form.value.workspaceConfig = {
          enabled: false,
          allowedOperations: [],
          maxFileSize: 1024,
          deniedExtensions: defaultDenied,
        }
        deniedExtensionsStr.value = defaultDenied.join(',')
      }

      if (editingAgent.value.reasoningPrompt) {
        promptMode.value = 'template'
        selectedTemplateCode.value = editingAgent.value.reasoningPrompt
        const template = promptTemplates.value.find(t => t.code === editingAgent.value!.reasoningPrompt)
        if (template) {
          selectedTemplate.value = template
        }
      }

      // 解析模型模板和自定义参数
      if (editingAgent.value.modelTemplateCode) {
        form.value.modelTemplateCode = editingAgent.value.modelTemplateCode
      }
      if (editingAgent.value.customModelParams) {
        try {
          const params = JSON.parse(editingAgent.value.customModelParams)
          customParams.value = {
            temperature: params.temperature ?? 0.7,
            topP: params.topP ?? 0.7,
            maxTokens: params.maxTokens ?? 4096,
            contextWindow: params.contextWindow ?? 8192,
          }
          enableCustomParams.value = true
        } catch (e) {
          console.error('解析自定义模型参数失败', e)
        }
      }
    } else {
      resetForm()
    }
    loadKbs()
    loadPromptTemplates()
    loadModelTemplates()
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
    status: true,
    modelTemplateCode: '',
    customModelParams: '',
    reasoningMode: 'NONE',
    reasoningPrompt: '',
    kbRetrievalMode: 'tool',
    workspaceConfig: {
      enabled: false,
      allowedOperations: [],
      maxFileSize: 1024,
      deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
    },
    appCode: '',
    isPublic: false,
  }
  deniedExtensionsStr.value = '.exe,.bat,.sh,.cmd,.js,.vbs'
  enableCustomParams.value = false
  currentPreset.value = ''
  customParams.value = {
    temperature: 0.7,
    topP: 0.7,
    maxTokens: 4096,
    contextWindow: 8192,
  }
  selectedModelTemplate.value = null
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

const loadModelTemplates = async () => {
  try {
    const response = await modelTemplateApi.getList({ pageSize: 100, status: true, modelType: 'llm' })
    if (response.data.code === 200) {
      modelTemplates.value = response.data.data.list
      if (form.value.modelTemplateCode) {
        const template = modelTemplates.value.find(t => t.code === form.value.modelTemplateCode)
        selectedModelTemplate.value = template || null
      }
    }
  } catch (error) {
    console.error('加载模型模板列表失败', error)
  }
}

const handleModelTemplateChange = (code: string) => {
  if (code) {
    const template = modelTemplates.value.find(t => t.code === code)
    selectedModelTemplate.value = template || null
  } else {
    selectedModelTemplate.value = null
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

const getSkillName = (name: string) => {
  const skill = props.availableSkills.find(s => s.name === name)
  return skill?.name || name
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

      // 处理自定义模型参数
      if (enableCustomParams.value) {
        form.value.customModelParams = JSON.stringify(customParams.value)
      } else {
        form.value.customModelParams = ''
      }

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

.section-desc {
  font-size: 13px;
  color: #909399;
  margin-bottom: 16px;
  padding-left: 8px;
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
  width: 100%;
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

.model-call-guide {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f6f8fa 0%, #f0f2f5 100%);
  border: 1px solid #e4e7ed;
  border-radius: 8px;

  .guide-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #606266;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e4e7ed;
  }

  .guide-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .guide-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
  }

  .guide-label {
    flex-shrink: 0;
    min-width: 70px;
    color: #909399;
    font-weight: 500;
  }

  .guide-value {
    color: #606266;
  }
}

.template-info-card {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  border: 1px solid #b3d8ff;
  border-radius: 8px;

  .info-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #409eff;
    margin-bottom: 12px;
  }

  .info-card-body {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .param-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .param-label {
    font-size: 12px;
    color: #909399;
  }

  .param-value {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.preset-quick-select {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;

  .preset-label {
    font-size: 13px;
    color: #606266;
    font-weight: 500;
  }
}

.custom-params-card {
  padding: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 16px;
}

.param-config-item {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  &.compact {
    margin-bottom: 0;
  }

  .param-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .param-name {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }

  .param-slider {
    margin: 8px 0;
  }

  .param-desc {
    font-size: 12px;
    color: #909399;
    margin-top: 8px;
  }
}

.params-compare {
  margin-top: 16px;
  padding: 16px;
  background: #fff9e6;
  border: 1px solid #ffc107;
  border-radius: 8px;

  .compare-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #e6a23c;
    margin-bottom: 12px;
  }

  .compare-table {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    overflow: hidden;
  }

  .compare-row {
    display: flex;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
      border-bottom: none;
    }

    &.header {
      background: #f5f7fa;
      font-weight: 500;
    }
  }

  .compare-cell {
    flex: 1;
    padding: 10px 12px;
    font-size: 13px;
    color: #606266;
    text-align: center;

    &.highlight {
      color: #409eff;
      font-weight: 500;
    }

    &.diff-up {
      color: #67c23a;
    }

    &.diff-down {
      color: #f56c6c;
    }

    &.diff-same {
      color: #909399;
    }
  }
}

:deep(.el-slider__marks-text) {
  font-size: 11px;
  color: #909399;
}
</style>

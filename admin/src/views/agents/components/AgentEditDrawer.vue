<template>
  <el-drawer :model-value="visible" :title="editingAgent ? $t('agent.editAgent') : $t('agent.createAgent')" direction="rtl" size="680px"
    class="agent-edit-drawer" @update:model-value="handleClose">
    <el-form :model="form" :rules="rules" label-width="100px" ref="formRef" class="agent-form">
      <div class="form-section">
        <div class="section-title">{{ $t('agent.basicInfo') }}</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('agent.agentName')" prop="name" required>
              <el-input v-model="form.name" :placeholder="$t('agent.agentNamePlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('agent.agentCode')" prop="code" required>
              <el-input v-model="form.code" :placeholder="$t('agent.agentCodePlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="$t('agent.belongApp')">
          <AppSelector v-model="form.appCode" :placeholder="$t('component.selectApp')" clearable />
        </el-form-item>

        <el-form-item :label="$t('agent.publicStatus')">
          <el-switch v-model="form.isPublic" :active-text="$t('agent.public')" :inactive-text="$t('agent.private')" />
          <div class="field-tip">{{ $t('agent.publicTip') }}</div>
        </el-form-item>

        <el-form-item :label="$t('agent.systemPrompt')" prop="systemPrompt" required>
          <el-input v-model="form.systemPrompt" type="textarea" :rows="4" :placeholder="$t('agent.systemPromptPlaceholder')" />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('agent.modelParamsConfig') }}</div>
        <div class="section-desc">{{ $t('agent.modelParamsDesc') }}</div>

        <div class="model-call-guide">
          <div class="guide-header">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ $t('agent.modelCallMechanism') }}</span>
          </div>
          <div class="guide-content">
            <div class="guide-item">
              <span class="guide-label">{{ $t('agent.callFlow') }}</span>
              <span class="guide-value">{{ $t('agent.callFlowDesc') }}</span>
            </div>
            <div class="guide-item">
              <span class="guide-label">{{ $t('agent.contextManagement') }}</span>
              <span class="guide-value">{{ $t('agent.contextManagementDesc') }}</span>
            </div>
          </div>
        </div>

        <el-form-item :label="$t('agent.modelTemplate')">
          <el-select v-model="form.modelTemplateCode" :placeholder="$t('agent.selectModelTemplate')" clearable class="w-full" @change="handleModelTemplateChange">
            <el-option v-for="template in modelTemplates" :key="template.code" :label="template.name" :value="template.code">
              <div class="template-option">
                <span>{{ template.name }}</span>
                <el-tag size="small" type="info">{{ template.sceneTag || $t('agent.general') }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <div v-if="selectedModelTemplate" class="template-info-card">
          <div class="info-card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ $t('agent.templateParamsPreview') }}</span>
          </div>
          <div class="info-card-body">
            <div class="param-item">
              <span class="param-label">{{ $t('agent.temperature') }}</span>
              <span class="param-value">{{ selectedModelTemplate.temperature }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">{{ $t('agent.topP') }}</span>
              <span class="param-value">{{ selectedModelTemplate.topP }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">{{ $t('agent.maxTokens') }}</span>
              <span class="param-value">{{ selectedModelTemplate.maxTokens }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">{{ $t('agent.contextWindow') }}</span>
              <span class="param-value">{{ selectedModelTemplate.contextWindow }}</span>
            </div>
          </div>
        </div>

        <el-form-item :label="$t('agent.customParams')">
          <el-switch v-model="enableCustomParams" :active-text="$t('agent.enable')" :inactive-text="$t('agent.disable')" />
        </el-form-item>

        <template v-if="enableCustomParams">
          <div class="preset-quick-select">
            <span class="preset-label">{{ $t('agent.quickPreset') }}</span>
            <el-button-group>
              <el-button size="small" :type="currentPreset === 'precise' ? 'primary' : 'default'" @click="applyPreset('precise')">
                {{ $t('agent.preciseMode') }}
              </el-button>
              <el-button size="small" :type="currentPreset === 'balanced' ? 'primary' : 'default'" @click="applyPreset('balanced')">
                {{ $t('agent.balancedMode') }}
              </el-button>
              <el-button size="small" :type="currentPreset === 'creative' ? 'primary' : 'default'" @click="applyPreset('creative')">
                {{ $t('agent.creativeMode') }}
              </el-button>
            </el-button-group>
          </div>

          <div class="custom-params-card">
            <div class="param-config-item">
              <div class="param-header">
                <span class="param-name">{{ $t('agent.temperatureParam') }}</span>
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
                <span v-if="customParams.temperature < 0.3">{{ $t('agent.preciseOutput') }}</span>
                <span v-else-if="customParams.temperature < 0.7">{{ $t('agent.balancedOutput') }}</span>
                <span v-else>{{ $t('agent.creativeOutput') }}</span>
              </div>
            </div>

            <div class="param-config-item">
              <div class="param-header">
                <span class="param-name">{{ $t('agent.topPParam') }}</span>
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
              <div class="param-desc">{{ $t('agent.topPDesc') }}</div>
            </div>

            <el-row :gutter="16">
              <el-col :span="12">
                <div class="param-config-item compact">
                  <div class="param-header">
                    <span class="param-name">{{ $t('agent.maxGenerationLength') }}</span>
                  </div>
                  <el-input-number 
                    v-model="customParams.maxTokens" 
                    :min="256" 
                    :max="128000" 
                    :step="256" 
                    class="w-full"
                    controls-position="right"
                  />
                  <div class="param-desc">{{ $t('agent.maxGenerationLengthDesc') }}</div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="param-config-item compact">
                  <div class="param-header">
                    <span class="param-name">{{ $t('agent.contextWindow') }}</span>
                  </div>
                  <el-input-number 
                    v-model="customParams.contextWindow" 
                    :min="1024" 
                    :max="128000" 
                    :step="1024" 
                    class="w-full"
                    controls-position="right"
                  />
                  <div class="param-desc">{{ $t('agent.contextWindowDesc') }}</div>
                </div>
              </el-col>
            </el-row>
          </div>

          <div v-if="selectedModelTemplate" class="params-compare">
            <div class="compare-title">
              <el-icon><Warning /></el-icon>
              <span>{{ $t('agent.paramsCompare') }}</span>
            </div>
            <div class="compare-table">
              <div class="compare-row header">
                <span class="compare-cell">{{ $t('agent.parameter') }}</span>
                <span class="compare-cell">{{ $t('agent.templateValue') }}</span>
                <span class="compare-cell">{{ $t('agent.customValue') }}</span>
                <span class="compare-cell">{{ $t('agent.difference') }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">{{ $t('agent.temperature') }}</span>
                <span class="compare-cell">{{ selectedModelTemplate.temperature }}</span>
                <span class="compare-cell highlight">{{ customParams.temperature }}</span>
                <span class="compare-cell" :class="getDiffClass(customParams.temperature - selectedModelTemplate.temperature)">
                  {{ formatDiff(customParams.temperature - selectedModelTemplate.temperature) }}
                </span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">{{ $t('agent.topP') }}</span>
                <span class="compare-cell">{{ selectedModelTemplate.topP }}</span>
                <span class="compare-cell highlight">{{ customParams.topP }}</span>
                <span class="compare-cell" :class="getDiffClass(customParams.topP - selectedModelTemplate.topP)">
                  {{ formatDiff(customParams.topP - selectedModelTemplate.topP) }}
                </span>
              </div>
              <div class="compare-row">
                <span class="compare-cell">{{ $t('agent.maxTokens') }}</span>
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
        <div class="section-title">{{ $t('agent.reasoningConfig') }}</div>
        <el-form-item :label="$t('agent.reasoningMode')">
          <el-select v-model="form.reasoningMode" :placeholder="$t('agent.pleaseSelectReasoningMode')" class="w-full">
            <el-option :label="$t('agent.defaultMode')" value="NONE">
              <span>{{ $t('agent.defaultMode') }}</span>
              <span class="option-desc">{{ $t('agent.defaultModeDesc') }}</span>
            </el-option>
            <el-option :label="$t('agent.reactMode')" value="REACT">
              <span>{{ $t('agent.reactMode') }}</span>
              <span class="option-desc">{{ $t('agent.reactModeDesc') }}</span>
            </el-option>
            <el-option :label="$t('agent.planMode')" value="PLAN">
              <span>{{ $t('agent.planMode') }}</span>
              <span class="option-desc">{{ $t('agent.planModeDesc') }}</span>
            </el-option>
            <el-option :label="$t('agent.reflectMode')" value="REFLECT">
              <span>{{ $t('agent.reflectMode') }}</span>
              <span class="option-desc">{{ $t('agent.reflectModeDesc') }}</span>
            </el-option>
          </el-select>
          <div class="mode-tip" v-if="form.reasoningMode">
            <el-icon>
              <InfoFilled />
            </el-icon>
            <span>{{ reasoningModeTip }}</span>
          </div>
        </el-form-item>

        <el-form-item v-if="form.reasoningMode && form.reasoningMode !== 'NONE'" :label="$t('agent.reasoningPrompt')">
          <div class="prompt-wrapper">
            <div class="prompt-mode-switch">
              <el-radio-group v-model="promptMode" size="small">
                <el-radio-button value="template">{{ $t('agent.useTemplate') }}</el-radio-button>
                <el-radio-button value="custom">{{ $t('agent.customInput') }}</el-radio-button>
              </el-radio-group>
            </div>

            <div v-if="promptMode === 'template'" class="template-selector">
              <el-select v-model="selectedTemplateCode" :placeholder="$t('agent.selectPromptTemplate')" @change="handleTemplateChange"
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
                  <span>{{ $t('agent.templatePreview') }}</span>
                  <el-button size="small" text @click="showTemplateDetail = true">
                    {{ $t('agent.viewDetails') }}
                  </el-button>
                </div>
                <el-input :model-value="selectedTemplate.content" type="textarea" :rows="6" readonly />
              </div>
            </div>

            <el-input v-else v-model="form.reasoningPrompt" type="textarea" :rows="4"
              :placeholder="$t('agent.optionalCustomPrompt')" />

            <div class="prompt-help">
              <div class="help-title">{{ $t('agent.availablePlaceholders') }}</div>
              <div class="help-items">
                <span class="help-item"><code>{TOOLS}</code> {{ $t('agent.toolsPlaceholder') }}</span>
                <span class="help-item"><code>{TOOL_NAMES}</code> {{ $t('agent.toolNamesPlaceholder') }}</span>
              </div>
              <el-collapse class="help-collapse">
                <el-collapse-item :title="$t('agent.viewExampleTemplate')">
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
        <div class="section-title">{{ $t('agent.capabilityBinding') }}</div>
        <div class="section-desc">{{ $t('agent.capabilityBindingDesc') }}</div>
        <el-form-item :label="$t('agent.bindSkills')" prop="skills">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleSelectSkills">
              <el-icon>
                <Plus />
              </el-icon>
              {{ $t('agent.selectSkills') }}
            </el-button>
            <div class="bind-content">
              <div v-if="selectedSkillCodes.length === 0" class="empty-tip">
                <el-icon>
                  <Warning />
                </el-icon>
                <span>{{ $t('agent.noSkills') }}</span>
              </div>
              <div v-else class="tag-list">
                <el-tag v-for="code in selectedSkillCodes" :key="code" closable @close="removeSkill(code)">
                  {{ getSkillName(code) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="MCP Server" prop="mcpServers">
          <div class="bind-wrapper">
            <el-button type="primary" plain @click="handleSelectMcpServers">
              <el-icon>
                <Plus />
              </el-icon>
              {{ $t('agent.selectMcpServer') }}
            </el-button>
            <div class="bind-content">
              <div v-if="selectedMcpServerNames.length === 0" class="empty-tip">
                <el-icon>
                  <Warning />
                </el-icon>
                <span>{{ $t('agent.noMcpServer') }}</span>
              </div>
              <div v-else class="tag-list">
                <el-tag v-for="name in selectedMcpServerNames" :key="name" closable @close="removeMcpServer(name)">
                  {{ name }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="内置工具" prop="allowedBuiltinTools">
          <BuiltinToolSelector v-model="selectedBuiltinTools" />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('agent.knowledgeBaseConfig') }}</div>
        <div class="section-desc">{{ $t('agent.knowledgeBaseConfigDesc') }}</div>
        <KbRetrievalConfig
          v-model="form.kbRetrievalConfig"
          v-model:knowledgeBases="form.knowledgeBases"
        />
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('agent.workspace') }}</div>
        <div class="section-desc">{{ $t('agent.enableWorkspaceDesc') }}</div>

        <el-form-item :label="$t('agent.enableWorkspace')">
          <el-switch v-model="form.workspaceConfig.enabled" :active-text="$t('agent.enable')" :inactive-text="$t('agent.disable')" />

        </el-form-item>

        <template v-if="form.workspaceConfig.enabled">
          <el-form-item :label="$t('agent.allowedOperations')">
            <el-checkbox-group v-model="form.workspaceConfig.allowedOperations">
              <el-checkbox value="read_file">{{ $t('agent.readFile') }}</el-checkbox>
              <el-checkbox value="read_dir">{{ $t('agent.readDir') }}</el-checkbox>
              <el-checkbox value="write_file">{{ $t('agent.writeFile') }}</el-checkbox>
              <el-checkbox value="append_file">{{ $t('agent.appendFile') }}</el-checkbox>
              <el-checkbox value="create_dir">{{ $t('agent.createDir') }}</el-checkbox>
              <el-checkbox value="delete_file">{{ $t('agent.deleteFile') }}</el-checkbox>
            </el-checkbox-group>
            <div class="field-tip">{{ $t('agent.allowedOperationsTip') }}</div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item :label="$t('agent.fileSizeLimit')">
                <el-input-number v-model="form.workspaceConfig.maxFileSize" :min="1" :max="10240" :step="100"
                  class="w-full" />
                <div class="field-tip">{{ $t('agent.fileSizeLimitTip') }}</div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-form-item :label="$t('agent.deniedExtensions')">
              <el-input v-model="deniedExtensionsStr" :placeholder="$t('agent.deniedExtensionsPlaceholder')"
                @change="handleDeniedExtensionsChange" />
              <div class="field-tip">{{ $t('agent.deniedExtensionsTip') }}</div>
            </el-form-item>
          </el-row>
        </template>
      </div>

      <div class="form-section">
        <div class="section-title">{{ $t('agent.advancedSettings') }}</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('agent.maxSteps')">
              <el-input-number v-model="form.maxSteps" :min="1" :max="999" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('common.status')">
              <el-switch v-model="form.status" :active-text="$t('common.enable')" :inactive-text="$t('common.disable')" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">{{ $t('common.save') }}</el-button>
      </div>
    </template>

    <SkillSelectDialog v-model="skillSelectDialogVisible" :skills="availableSkills" :selected-codes="selectedSkillCodes"
      @confirm="handleSkillSelect" />

    <el-dialog
      v-model="mcpServerSelectDialogVisible"
      :title="$t('agent.selectMcpServer')"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="mcp-server-filter">
        <el-input
          v-model="mcpServerSearchForm.keyword"
          :placeholder="$t('agent.searchName')"
          clearable
          style="width: 200px"
          @input="handleMcpServerSearch"
        />
      </div>
      <el-table
        :data="availableMcpServers"
        v-loading="mcpServerLoading"
        @selection-change="handleMcpServerSelectionChange"
        ref="mcpServerTableRef"
        max-height="400"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" :label="$t('common.name')" width="150" />
        <el-table-column prop="displayName" :label="$t('agent.displayName')" width="150">
          <template #default="{ row }">
            {{ row.displayName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="$t('common.description')" show-overflow-tooltip />
        <el-table-column :label="$t('common.status')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? $t('common.enable') : $t('common.disable') }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="mcpServerSearchForm.page"
          v-model:page-size="mcpServerSearchForm.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="mcpServerTotal"
          layout="total, sizes, prev, pager, next"
          small
          @size-change="loadMcpServers"
          @current-change="loadMcpServers"
        />
      </div>
      <template #footer>
        <el-button @click="mcpServerSelectDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmMcpServerSelection">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed, reactive, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, InfoFilled, Warning } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { Agent, AgentForm, WorkspaceAgentConfig, KbRetrievalConfig as KbRetrievalConfigType } from '@/api/agent'
import { useI18n } from 'vue-i18n'
import BuiltinToolSelector from './BuiltinToolSelector.vue'

const { t } = useI18n()

interface InternalCustomModelParams {
  temperature: number
  topP: number
  maxTokens: number
  contextWindow: number
}

interface InternalAgentForm {
  name: string
  code: string
  description?: string
  systemPrompt: string
  skills: string
  mcpServers?: string
  allowedBuiltinTools?: string
  maxSteps: number
  status: boolean
  modelTemplateCode?: string
  customModelParams?: string
  reasoningMode?: string
  reasoningPrompt?: string
  workspaceConfig: WorkspaceAgentConfig
  knowledgeBases: string
  kbRetrievalConfig: KbRetrievalConfigType
  appCode?: string
  isPublic?: boolean
}
import type { StandardSkill } from '@/api/skill'
import type { PromptTemplate } from '@/api/prompt-template'
import type { ModelTemplate } from '@/api/model-template'
import { promptTemplateApi } from '@/api/prompt-template'
import { modelTemplateApi } from '@/api/model-template'
import { mcpServerApi } from '@/api/mcp-server'
import SkillSelectDialog from './SkillSelectDialog.vue'
import KbRetrievalConfig from './KbRetrievalConfig.vue'
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

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = ref<InternalAgentForm>({
  name: '',
  code: '',
  systemPrompt: '',
  skills: '[]',
  mcpServers: '[]',
  allowedBuiltinTools: '[]',
  maxSteps: 5,
  status: true,
  modelTemplateCode: '',
  customModelParams: '',
  reasoningMode: 'NONE',
  reasoningPrompt: '',
  workspaceConfig: {
    enabled: false,
    allowedOperations: [],
    maxFileSize: 1024,
    deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
  },
  knowledgeBases: '[]',
  kbRetrievalConfig: {
    strategy: 'HYBRID',
    autoRetrieval: {
      enabled: true,
      showSources: true,
      trigger: 'always',
    },
    toolRetrieval: {
      enabled: true,
      allowSpecifyKb: true,
    },
  },
  appCode: '',
  isPublic: false,
})

const editingAgent = computed(() => props.agent)

const selectedBuiltinTools = computed({
  get: () => {
    try {
      return form.value.allowedBuiltinTools ? JSON.parse(form.value.allowedBuiltinTools) : []
    } catch {
      return []
    }
  },
  set: (value: string[]) => {
    form.value.allowedBuiltinTools = JSON.stringify(value)
  }
})

const skillSelectDialogVisible = ref(false)
const selectedSkillCodes = ref<string[]>([])

const mcpServerSelectDialogVisible = ref(false)
const selectedMcpServerNames = ref<string[]>([])
const availableMcpServers = ref<any[]>([])
const mcpServerLoading = ref(false)
const mcpServerTotal = ref(0)
const mcpServerTableRef = ref()
const tempSelectedMcpServers = ref<any[]>([])
const mcpServerSearchForm = reactive({
  keyword: '',
  page: 1,
  pageSize: 10,
})

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
  0: t('agent.preciseMode'),
  0.3: t('agent.balancedMode'),
  0.7: t('agent.creativeMode'),
  1: t('agent.creativeMode')
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
  if (value === undefined) return t('agent.disable')
  if (value < 0.3) return t('agent.preciseMode')
  if (value < 0.7) return t('agent.balancedMode')
  return t('agent.creativeMode')
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
    NONE: t('agent.defaultModeDesc'),
    REACT: t('agent.reactModeDesc'),
    PLAN: t('agent.planModeDesc'),
    REFLECT: t('agent.reflectModeDesc')
  }
  const mode = form.value.reasoningMode
  return mode ? tips[mode] || '' : ''
})

const rules: FormRules = {
  name: [{ required: true, message: t('agent.pleaseInputAgentName'), trigger: 'blur' }],
  code: [{ required: true, message: t('agent.pleaseInputAgentCode'), trigger: 'blur' }],
  systemPrompt: [{ required: true, message: t('agent.pleaseInputSystemPrompt'), trigger: 'blur' }]
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
        appCode: editingAgent.value.appCode || '',
        isPublic: editingAgent.value.isPublic ?? false,
        workspaceConfig: {
          enabled: false,
          allowedOperations: [],
          maxFileSize: 1024,
          deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
        },
        knowledgeBases: (editingAgent.value as any).knowledgeBases || '[]',
        kbRetrievalConfig: {
          strategy: 'HYBRID',
          autoRetrieval: {
            enabled: true,
            showSources: true,
            trigger: 'always',
          },
          toolRetrieval: {
            enabled: true,
            allowSpecifyKb: true,
          },
        },
      }
      selectedSkillCodes.value = parseJsonSafe(editingAgent.value.skills || '[]')
      selectedMcpServerNames.value = parseJsonSafe(editingAgent.value.mcpServers || '[]')

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

      // 解析 kbRetrievalConfig
      const rawKbConfig = (editingAgent.value as any).kbRetrievalConfig
      if (rawKbConfig) {
        try {
          const kbConfig = typeof rawKbConfig === 'string' ? JSON.parse(rawKbConfig) : rawKbConfig
          form.value.kbRetrievalConfig = {
            strategy: kbConfig.strategy || 'HYBRID',
            autoRetrieval: {
              enabled: kbConfig.autoRetrieval?.enabled ?? true,
              topN: kbConfig.autoRetrieval?.topN,
              similarityThresh: kbConfig.autoRetrieval?.similarityThresh,
              showSources: kbConfig.autoRetrieval?.showSources ?? true,
              trigger: kbConfig.autoRetrieval?.trigger || 'always',
              keywords: kbConfig.autoRetrieval?.keywords || [],
            },
            toolRetrieval: {
              enabled: kbConfig.toolRetrieval?.enabled ?? true,
              defaultTopN: kbConfig.toolRetrieval?.defaultTopN,
              defaultSimilarityThresh: kbConfig.toolRetrieval?.defaultSimilarityThresh,
              allowSpecifyKb: kbConfig.toolRetrieval?.allowSpecifyKb ?? true,
            },
          }
        } catch (e) {
          console.error('解析知识库检索配置失败', e)
        }
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
    maxSteps: 5,
    status: true,
    modelTemplateCode: '',
    customModelParams: '',
    reasoningMode: 'NONE',
    reasoningPrompt: '',
    workspaceConfig: {
      enabled: false,
      allowedOperations: [],
      maxFileSize: 1024,
      deniedExtensions: ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'],
    },
    knowledgeBases: '[]',
    kbRetrievalConfig: {
      strategy: 'HYBRID',
      autoRetrieval: {
        enabled: true,
        showSources: true,
        trigger: 'always',
      },
      toolRetrieval: {
        enabled: true,
        allowSpecifyKb: true,
      },
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
  selectedSkillCodes.value = []
  promptMode.value = 'template'
  selectedTemplateCode.value = ''
  selectedTemplate.value = null
  formRef.value?.resetFields()
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

const handleSelectMcpServers = async () => {
  mcpServerSelectDialogVisible.value = true
  await loadMcpServers()
}

const loadMcpServers = async () => {
  mcpServerLoading.value = true
  try {
    const { data } = await mcpServerApi.getList({
      enabled: true,
      page: mcpServerSearchForm.page,
      pageSize: mcpServerSearchForm.pageSize,
    })
    availableMcpServers.value = data.data.list || []
    mcpServerTotal.value = data.data.total
    
    if (mcpServerTableRef.value && availableMcpServers.value.length > 0) {
      nextTick(() => {
        availableMcpServers.value.forEach(server => {
          if (selectedMcpServerNames.value.includes(server.name)) {
            mcpServerTableRef.value.toggleRowSelection(server, true)
          }
        })
      })
    }
  } catch (error) {
    ElMessage.error('获取 MCP Server 列表失败')
  } finally {
    mcpServerLoading.value = false
  }
}

const handleMcpServerSearch = () => {
  mcpServerSearchForm.page = 1
  loadMcpServers()
}

const handleMcpServerSelectionChange = (selection: any[]) => {
  tempSelectedMcpServers.value = selection
}

const confirmMcpServerSelection = () => {
  const names = tempSelectedMcpServers.value.map(s => s.name)
  selectedMcpServerNames.value = names
  form.value.mcpServers = JSON.stringify(names)
  mcpServerSelectDialogVisible.value = false
}

const removeMcpServer = (name: string) => {
  const index = selectedMcpServerNames.value.indexOf(name)
  if (index > -1) {
    selectedMcpServerNames.value.splice(index, 1)
    form.value.mcpServers = JSON.stringify(selectedMcpServerNames.value)
  }
}

// 保存前端验证和数据处理
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

      // 处理自定义模型参数
      if (enableCustomParams.value) {
        form.value.customModelParams = JSON.stringify(customParams.value)
      } else {
        form.value.customModelParams = ''
      }

      // 构建提交数据
      const submitData = {
        ...form.value,
        kbRetrievalConfig: JSON.stringify(form.value.kbRetrievalConfig),
      }

      saving.value = true
      try {
        await emit('save', submitData)
        ElMessage.success(editingAgent.value ? '更新成功' : '创建成功')
        handleClose()
      } catch (error) {
        ElMessage.error('保存失败')
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

.mcp-server-list {
  max-height: 400px;
  overflow-y: auto;
}

.mcp-server-item {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    background: #f5f7fa;
  }
}

.server-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.server-name {
  font-weight: 500;
  color: #303133;
}

.server-desc {
  font-size: 12px;
  color: #909399;
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

.mcp-server-filter {
  margin-bottom: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>

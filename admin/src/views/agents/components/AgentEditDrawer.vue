<template>
  <el-drawer
    :model-value="visible"
    :title="editingAgent ? '编辑智能体' : '创建智能体'"
    direction="rtl"
    size="600px"
    @update:model-value="handleClose"
  >
    <el-form :model="form" :rules="rules" label-width="120px" ref="formRef">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="智能体名称" prop="name" required>
            <el-input v-model="form.name" placeholder="如：天气助手" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="智能体标识" prop="code" required>
            <el-input v-model="form.code" placeholder="如：weather_assistant" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="系统提示词" prop="systemPrompt" required>
        <el-input
          v-model="form.systemPrompt"
          type="textarea"
          :rows="5"
          placeholder="定义智能体的角色和行为方式"
        />
      </el-form-item>

      <el-form-item label="绑定技能" prop="skills">
        <div style="width: 100%;">
          <el-button type="primary" @click="handleSelectSkills" style="margin-bottom: 12px;">
            <el-icon><Plus /></el-icon>
            选择技能
          </el-button>
          <div class="selected-skills-display">
            <div v-if="selectedSkillCodes.length === 0" class="no-skills">
              <span style="color: #909399;">暂未绑定技能</span>
            </div>
            <div v-else class="skill-tags">
              <el-tag
                v-for="code in selectedSkillCodes"
                :key="code"
                closable
                @close="removeSkill(code)"
                style="margin: 4px;"
              >
                {{ getSkillName(code) }} ({{ code }})
              </el-tag>
            </div>
          </div>

          <el-alert type="info" :closable="false" style="margin-top: 12px;">
            <template #title>
              <strong>📝 技能绑定说明</strong>
            </template>
            <div class="skill-example">
              <p><strong>数据格式：</strong></p>
              <p style="margin: 8px 0; color: #666; font-size: 13px;">
                使用JSON数组格式填写技能标识，每个技能标识用双引号包裹，多个技能用逗号分隔
              </p>
              
              <p style="margin-top: 12px;"><strong>示例：</strong></p>
              <pre class="code-example">["get_weather", "get_time", "send_email"]</pre>
        
              <p style="margin-top: 12px; color: #666; font-size: 12px;">
                💡 提示：智能体会根据用户问题自动判断是否需要调用绑定的技能
              </p>
            </div>
          </el-alert>
        </div>
      </el-form-item>

      <el-form-item label="绑定MCP Server" prop="mcpServers">
        <div style="width: 100%;">
          <el-button type="primary" @click="handleAddMcpServer" style="margin-bottom: 12px;">
            <el-icon><Plus /></el-icon>
            添加 MCP Server
          </el-button>

          <div v-if="mcpServers.length === 0" class="no-mcp-servers">
            <el-empty description="暂未绑定 MCP Server" :image-size="80" />
          </div>

          <div v-else>
            <McpServerCard
              v-for="(config, index) in mcpServers"
              :key="index"
              :config="config"
              @delete="handleDeleteMcpServer(index)"
              @edit="handleEditMcpServer(index)"
            />
          </div>

          <el-alert type="info" :closable="false" style="margin-top: 12px;">
            <template #title>
              <strong>💡 MCP Server 说明</strong>
            </template>
            <div style="font-size: 13px; line-height: 1.6;">
              <p><strong>MCP Server</strong>：Model Context Protocol Server，提供外部工具和数据源</p>
              <p style="margin-top: 8px;"><strong>工具命名规范：</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>技能工具：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">{skillCode}</code></li>
                <li>MCP工具：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">mcp:{serverName}:{toolName}</code></li>
              </ul>
              <p style="margin-top: 8px; color: #666;">
                示例：<code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px;">mcp:filesystem:read_file</code>
              </p>
            </div>
          </el-alert>
        </div>
      </el-form-item>

      <el-form-item label="绑定知识库" prop="knowledgeBases">
        <div style="width: 100%;">
          <el-button type="primary" @click="handleSelectKbs" style="margin-bottom: 12px;">
            <el-icon><Plus /></el-icon>
            选择知识库
          </el-button>
          <div class="selected-kbs-display">
            <div v-if="selectedKbCodes.length === 0" class="no-kbs">
              <span style="color: #909399;">暂未绑定知识库</span>
            </div>
            <div v-else class="kb-tags">
              <el-tag
                v-for="code in selectedKbCodes"
                :key="code"
                closable
                @close="removeKb(code)"
                style="margin: 4px;"
              >
                {{ getKbName(code) }} ({{ code }})
              </el-tag>
            </div>
          </div>

          <el-alert type="info" :closable="false" style="margin-top: 12px;">
            <template #title>
              <strong>📚 知识库绑定说明</strong>
            </template>
            <div class="kb-example">
              <p><strong>功能说明：</strong></p>
              <p style="margin: 8px 0; color: #666; font-size: 13px;">
                绑定知识库后，智能体在回答问题时会自动检索知识库内容，基于知识库信息生成更准确的回答
              </p>
              
              <p style="margin-top: 12px;"><strong>使用场景：</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px; color: #666; font-size: 13px;">
                <li>企业知识库问答</li>
                <li>产品文档查询</li>
                <li>FAQ自动回复</li>
                <li>专业知识咨询</li>
              </ul>
        
              <p style="margin-top: 12px; color: #666; font-size: 12px;">
                💡 提示：智能体会自动从绑定的知识库中检索相关信息来增强回答
              </p>
            </div>
          </el-alert>
        </div>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="最大执行步数">
            <el-input-number v-model="form.maxSteps" :min="1" :max="20" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="温度参数">
            <el-input-number v-model="form.temperature" :min="0" :max="1" :step="0.1" style="width: 100%;" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">推理模式配置</el-divider>

      <el-form-item label="推理模式">
        <el-select v-model="form.reasoningMode" placeholder="请选择推理模式" style="width: 100%;">
          <el-option label="默认模式" value="NONE" />
          <el-option label="ReAct模式" value="REACT" />
          <el-option label="Plan模式" value="PLAN" />
          <el-option label="Reflect模式" value="REFLECT" />
        </el-select>
        <div class="form-tip" style="margin-top: 4px; font-size: 12px; color: #909399;">
          <p v-if="form.reasoningMode === 'NONE'" style="margin: 0;">直接工具调用，适合简单任务，响应最快</p>
          <p v-else-if="form.reasoningMode === 'REACT'" style="margin: 0;">思考-行动-观察循环，适合复杂推理场景</p>
          <p v-else-if="form.reasoningMode === 'PLAN'" style="margin: 0;">先规划再执行，适合多步骤任务</p>
          <p v-else-if="form.reasoningMode === 'REFLECT'" style="margin: 0;">执行后反思优化，适合需要质量保证的任务</p>
        </div>
      </el-form-item>

      <el-form-item 
        v-if="form.reasoningMode && form.reasoningMode !== 'NONE'" 
        label="自定义推理提示词"
      >
        <el-input
          v-model="form.reasoningPrompt"
          type="textarea"
          :rows="4"
          placeholder="可选：自定义推理提示词，留空使用默认模板。支持 {BASE_PROMPT} 和 {TOOLS} 占位符"
        />
      </el-form-item>

      <el-divider content-position="left">知识库检索配置</el-divider>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="检索模式">
            <el-select v-model="form.kbRetrievalMode" placeholder="请选择检索模式" style="width: 100%;">
              <el-option label="自动模式" value="auto" />
              <el-option label="工具模式" value="tool" />
              <el-option label="禁用知识库" value="disabled" />
            </el-select>
            <div style="margin-top: 4px; font-size: 12px; color: #909399;">
              <p v-if="form.kbRetrievalMode === 'auto'" style="margin: 0;">预检索+工具检索，快速响应</p>
              <p v-else-if="form.kbRetrievalMode === 'tool'" style="margin: 0;">仅作为工具调用，Agent自主决定检索时机</p>
              <p v-else-if="form.kbRetrievalMode === 'disabled'" style="margin: 0;">不使用知识库</p>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="检索方式">
            <el-select v-model="form.kbRetrievalMethod" placeholder="请选择检索方式" style="width: 100%;">
              <el-option label="自动选择" value="auto" />
              <el-option label="向量检索" value="vector" />
              <el-option label="BM25检索" value="bm25" />
            </el-select>
            <div style="margin-top: 4px; font-size: 12px; color: #909399;">
              <p v-if="form.kbRetrievalMethod === 'auto'" style="margin: 0;">自动选择最优方式</p>
              <p v-else-if="form.kbRetrievalMethod === 'vector'" style="margin: 0;">语义相似度匹配</p>
              <p v-else-if="form.kbRetrievalMethod === 'bm25'" style="margin: 0;">关键词精确匹配</p>
            </div>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="状态">
        <el-switch v-model="form.status" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="text-align: right;">
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
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { Agent, AgentForm } from '@/api/agent'
import type { McpServerConfig } from '@/api/mcp-server'
import type { Skill } from '@/api/skill'
import type { KbInfo } from '@/api/kb'
import { kbApi } from '@/api/kb'
import McpServerConfigDialog from './McpServerConfigDialog.vue'
import McpServerCard from './McpServerCard.vue'
import SkillSelectDialog from './SkillSelectDialog.vue'
import KbSelectDialog from './KbSelectDialog.vue'

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

const formRef = ref<FormInstance>()
const saving = ref(false)

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
  kbRetrievalMode: 'auto',
  kbRetrievalMethod: 'auto',
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

const rules: FormRules = {
  name: [
    { required: true, message: '请输入智能体名称', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入智能体标识', trigger: 'blur' }
  ],
  systemPrompt: [
    { required: true, message: '请输入系统提示词', trigger: 'blur' }
  ]
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
        knowledgeBases: editingAgent.value.knowledgeBases || '[]'
      }
      mcpServers.value = parseJsonSafe(editingAgent.value.mcpServers || '[]')
      selectedSkillCodes.value = parseJsonSafe(editingAgent.value.skills || '[]')
      selectedKbCodes.value = parseJsonSafe(editingAgent.value.knowledgeBases || '[]')
    } else {
      resetForm()
    }
    loadKbs()
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
    kbRetrievalMode: 'auto',
    kbRetrievalMethod: 'auto',
  }
  mcpServers.value = []
  selectedSkillCodes.value = []
  selectedKbCodes.value = []
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
        ElMessage.warning('技能列表格式错误，请使用JSON数组格式')
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
.selected-skills-display,
.selected-kbs-display {
  min-height: 60px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.no-skills,
.no-kbs {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.skill-tags,
.kb-tags {
  display: flex;
  flex-wrap: wrap;
}

.no-mcp-servers {
  padding: 20px;
  text-align: center;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>

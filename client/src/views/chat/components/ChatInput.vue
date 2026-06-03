<template>
  <div class="chat-input">
    <div class="input-wrapper">
      <div v-if="currentMode === 'chat'" class="agent-chips-bar">
        <div class="agent-chips-row">
          <div :class="['agent-chip', { active: !selectedAgent }]" @click="handleAgentSelect('')">
            <el-icon :size="13">
              <Cpu />
            </el-icon>
            <span>大模型</span>
          </div>
          <div v-for="agent in agents" :key="agent.id" :class="['agent-chip', { active: selectedAgent === agent.id }]"
            @click="handleAgentSelect(agent.id)">
            <el-icon :size="13">
              <User />
            </el-icon>
            <span>{{ agent.name }}</span>
          </div>
        </div>
      </div>

      <div v-if="showCommandMenu" class="command-menu">
        <div v-for="(cmd, idx) in filteredCommands" :key="cmd.name"
          :class="['command-item', { active: idx === commandIndex }]" @click="selectCommand(cmd)"
          @mouseenter="commandIndex = idx">
          <span class="command-name">/{{ cmd.name }}</span>
          <span class="command-desc">{{ cmd.description }}</span>
        </div>
      </div>

      <!-- 上拉模型选择器 -->
      <Teleport to="body">
        <Transition name="model-sheet">
          <div v-if="showModelSheet" class="model-sheet-overlay" @click.self="showModelSheet = false">
            <div class="model-sheet-panel">
              <div class="model-sheet-header">
                <span class="model-sheet-title">选择模型</span>
                <el-icon class="model-sheet-close" :size="20" @click="showModelSheet = false">
                  <Close />
                </el-icon>
              </div>
              <div class="model-sheet-body">
                <div :class="['model-sheet-item', { active: internalModelCode === 'mcp-llm' || !internalModelCode }]"
                  @click="selectModel('mcp-llm')">
                  <div class="model-sheet-icon mcp-icon">
                    <el-icon :size="20">
                      <Star />
                    </el-icon>
                  </div>
                  <div class="model-sheet-info">
                    <span class="model-sheet-name">Auto 智能调度</span>
                    <span class="model-sheet-desc">自动选择最优模型，支持负载均衡和故障转移</span>
                  </div>
                  <el-icon v-if="internalModelCode === 'mcp-llm' || !internalModelCode" class="model-sheet-check"
                    :size="18">
                    <Check />
                  </el-icon>
                </div>

                <div class="model-sheet-divider">
                  <span>指定模型</span>
                </div>

                <!-- 模型类型切换标签 -->
                <div class="model-type-tabs">
                  <div v-for="tab in modelTypeOptions" :key="tab.value"
                    :class="['model-type-tab', { active: internalModelType === tab.value }]"
                    @click="handleModelTypeTabChange(tab.value)">
                    <span class="model-type-tab-icon">{{ tab.icon }}</span>
                    <span class="model-type-tab-label">{{ tab.label }}</span>
                  </div>
                </div>



                <div v-for="model in enabledModels" :key="model.id"
                  :class="['model-sheet-item', { active: internalModelCode === model.code }]"
                  @click="selectModel(model.code)">
                  <div class="model-sheet-icon">
                    <el-icon :size="20">
                      <Cpu />
                    </el-icon>
                  </div>
                  <div class="model-sheet-info">
                    <span class="model-sheet-name">{{ model.name }}</span>
                    <span class="model-sheet-desc">{{ model.description || currentModelTypeLabel + '模型' }}</span>
                  </div>
                  <el-icon v-if="internalModelCode === model.code" class="model-sheet-check" :size="18">
                    <Check />
                  </el-icon>
                </div>

                <div v-if="enabledModels.length === 0" class="model-sheet-empty">
                  <el-icon :size="40" color="var(--text-tertiary)">
                    <Cpu />
                  </el-icon>
                  <span>暂无可用{{ currentModelTypeLabel }}模型</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- 上拉模式选择器 -->
      <Teleport to="body">
        <Transition name="sheet-fade">
          <div v-if="showModeSheet" class="mode-sheet-overlay" @click.self="showModeSheet = false">
            <div class="mode-sheet-panel">
              <div class="mode-sheet-header">
                <span class="mode-sheet-title">选择模式</span>
                <el-icon class="mode-sheet-close" :size="20" @click="showModeSheet = false">
                  <Close />
                </el-icon>
              </div>
              <div class="mode-sheet-body">
                <div v-for="item in modeOptions" :key="item.value"
                  :class="['mode-sheet-item', { active: currentMode === item.value }]"
                  @click="handleModeSheetSelect(item.value)">
                  <div :class="['mode-sheet-icon', `mode-icon-${item.value}`]">
                    <span class="mode-sheet-emoji">{{ item.icon }}</span>
                  </div>
                  <div class="mode-sheet-info">
                    <span class="mode-sheet-name">{{ item.label }}</span>
                    <span class="mode-sheet-desc">{{ item.description }}</span>
                  </div>
                  <el-icon v-if="currentMode === item.value" class="mode-sheet-check" :size="18">
                    <Check />
                  </el-icon>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <div class="input-container">
        <div class="input-bottom-bar">
          <div class="bottom-bar-left">
            <div class="mode-trigger" @click="showModeSheet = true">
              <span class="mode-trigger-icon">{{ currentModeIcon }}</span>
              <span class="mode-trigger-text">{{ currentModeLabel }}</span>
              <el-icon :size="12" class="mode-trigger-arrow">
                <ArrowUp />
              </el-icon>
            </div>
            <div class="model-trigger" @click="showModelSheet = true">
              <el-icon :size="14">
                <Cpu />
              </el-icon>
              <span class="model-trigger-text">{{ currentModelDisplayName }}</span>
              <span v-if="internalModelCode !== 'mcp-llm'" class="model-type-badge">{{ currentModelTypeLabel }}</span>
              <el-icon :size="12" class="model-trigger-arrow">
                <ArrowUp />
              </el-icon>
            </div>
            <div v-if="currentMode === 'chat' && selectedAgent && selectedAgentSupportsWorkspace"
              class="workspace-trigger" @click="handleWorkspaceTrigger">
              <template v-if="workspaceIsActive">
                <el-icon :size="14">
                  <FolderOpened />
                </el-icon>
                <span class="workspace-trigger-text">{{ workspaceDirName || '已选择' }}</span>
                <el-icon :size="12" class="workspace-trigger-clear" @click.stop="handleWorkspaceClear">
                  <Close />
                </el-icon>
              </template>
              <template v-else>
                <el-icon :size="14">
                  <Folder />
                </el-icon>
                <span class="workspace-trigger-text">请选择工作目录</span>
              </template>
            </div>
          </div>
          <div class="bottom-bar-right">
            <!-- 音视频对话主开关：进入/退出 AV 模式（TTS 语音 + 可选摄像头） -->
            <div class="video-trigger" :class="{ 'video-active': videoEnabled }" @click="handleVideoToggleClick"
              title="音视频对话（点击开启/关闭，摄像头在弹窗内控制）">
              <el-icon :size="16">
                <VideoCamera />
              </el-icon>
              <span class="video-trigger-badge" :class="{ active: videoEnabled }" />
            </div>
            <div class="voice-trigger" :class="{ 'voice-active': voiceEnabled }" @click="handleVoiceClick"
              @contextmenu.prevent="handleVoiceSettings"
              :title="voiceEnabled ? '语音播报已开启（点击切换，右键设置）' : '语音播报已关闭（点击切换，右键设置）'">
              <el-icon :size="16">
                <Headset />
              </el-icon>
              <span class="voice-trigger-badge" :class="{ active: voiceEnabled }" />
            </div>
          </div>

          <!-- 文件上传弹出层 -->
          <Teleport to="body">
            <Transition name="file-sheet">
              <div v-if="showFilePicker" class="file-sheet-overlay" @click.self="showFilePicker = false">
                <div class="file-sheet-panel">
                  <div class="file-sheet-header">
                    <span class="file-sheet-title">上传文件</span>
                    <el-icon class="file-sheet-close" :size="20" @click="showFilePicker = false">
                      <Close />
                    </el-icon>
                  </div>
                  <div class="file-sheet-body">
                    <div class="file-sheet-item" @click="selectFileType('image/*', 'image')">
                      <span class="file-sheet-emoji">🖼️</span>
                      <div class="file-sheet-info">
                        <div class="file-sheet-name">图片</div>
                        <div class="file-sheet-desc">上传 JPG、PNG、GIF 等格式图片</div>
                      </div>
                    </div>
                    <div class="file-sheet-item" @click="selectFileType('video/*', 'video')">
                      <span class="file-sheet-emoji">🎬</span>
                      <div class="file-sheet-info">
                        <div class="file-sheet-name">视频</div>
                        <div class="file-sheet-desc">上传 MP4、AVI、MOV 等格式视频</div>
                      </div>
                    </div>
                    <div class="file-sheet-item" @click="selectFileType('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar', 'file')">
                      <span class="file-sheet-emoji">📄</span>
                      <div class="file-sheet-info">
                        <div class="file-sheet-name">文件</div>
                        <div class="file-sheet-desc">上传 PDF、Word、Excel、PPT 等文档</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

          <input ref="fileInputRef" type="file" style="display: none" @change="handleFileChange" />
        </div>

        <!-- 摄像头控制面板 -->
        <Teleport to="body">
          <Transition name="video-sheet">
            <div v-if="showCameraPreview" class="video-sheet-overlay">
              <div class="video-sheet-panel" :style="{ transform: `translate(${panelOffsetX}px, ${panelOffsetY}px)` }">
                <div class="video-sheet-header" @mousedown="handlePanelDragStart">
                  <span class="video-sheet-title">音视频控制</span>
                  <div class="video-sheet-header-right">
                    <el-button size="small" round @click="showCameraPreview = false">
                      关闭
                    </el-button>
                  </div>
                </div>
                <div class="video-sheet-body">
                  <!-- 摄像头开关按钮 -->
                  <div class="camera-control-row">
                    <span class="camera-control-label">摄像头</span>
                    <el-button
                      :type="cameraActive ? 'primary' : 'default'"
                      :icon="cameraActive ? VideoCameraFilled : VideoCamera"
                      round
                      size="small"
                      @click="handleCameraToggle"
                    >
                      {{ cameraActive ? '关闭摄像头' : '开启摄像头' }}
                    </el-button>
                  </div>
                  <!-- 视频预览区域 -->
                  <div v-if="cameraActive" class="camera-preview-area">
                    <video ref="videoRef" autoplay playsinline muted class="camera-video"></video>
                    <canvas ref="canvasRef" class="camera-canvas" style="display:none"></canvas>
                  </div>
                  <div v-else class="camera-preview-placeholder">
                    <el-icon :size="48" color="#999">
                      <VideoCamera />
                    </el-icon>
                    <p>摄像头未开启</p>
                    <p class="camera-hint">仅使用语音进行对话</p>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <el-input ref="inputRef" v-model="inputText" type="textarea" :rows="3" :placeholder="getPlaceholder()"
          @keydown="handleKeydown" @input="handleInput" :disabled="isLoading" resize="none" />
        <div class="input-actions">
          <!-- 附件上传按钮 -->
          <div
            v-if="!isLoading"
            class="attach-btn"
            @click="showFilePicker = true"
            title="上传附件"
          >
            <el-icon :size="20">
              <Paperclip />
            </el-icon>
          </div>
          <!-- 语音输入按钮（按住录音，松开发送识别） -->
          <div
            v-if="voiceSupported && !isLoading"
            class="voice-input-btn"
            :class="{
              'is-recording': isVoiceRecording,
              'is-recognizing': isVoiceRecognizing
            }"
            @mousedown.prevent="handleVoicePress"
            @mouseup.prevent="handleVoiceRelease"
            @mouseleave.prevent="handleVoiceCancel"
            title="按住说话，松开识别"
          >
            <el-icon :size="20">
              <Microphone />
            </el-icon>
            <span v-if="voiceStatusText" class="voice-status-text">{{ voiceStatusText }}</span>
          </div>
          <el-button v-if="isLoading" type="danger" @click="emit('stop')" circle>
            <el-icon>
              <VideoPause />
            </el-icon>
          </el-button>
          <el-button v-else type="primary" :disabled="!inputText.trim()" @click="handleSend" circle>
            <el-icon>
              <Promotion />
            </el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
  <VoiceSettings ref="voiceSettingsRef" />
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Promotion, Cpu, User, VideoPause, Star, ArrowUp, Close, Folder, FolderOpened, Check, Headset, Paperclip, VideoCamera, VideoCameraFilled, Microphone } from '@element-plus/icons-vue'
import VoiceSettings from './VoiceSettings.vue'
import { useCamera } from '../../../composables/useCamera'
import { useVoiceInput } from '../../../composables/useVoiceInput'

/**
 * 斜杠命令定义
 */
interface SlashCommand {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description: string
  /** 命令动作 */
  action: () => void
}

/**
 * 智能体定义
 */
interface Agent {
  /** 智能体ID */
  id: string
  /** 智能体名称 */
  name: string
  /** 描述 */
  description?: string
  /** 状态 */
  status?: boolean
  /** 是否支持工作目录 */
  supportsWorkspace?: boolean
}

interface Props {
  /** 加载状态 */
  isLoading: boolean
  /** 聊天模式 */
  mode?: 'chat' | 'rag' | 'retrieval'
  /** 智能体列表 */
  agents?: Agent[]
  /** 工作目录是否激活 */
  workspaceIsActive?: boolean
  /** 工作目录名称 */
  workspaceDirName?: string | null
  /** 模型列表 */
  models?: any[]
  /** 当前选中的模型编码 */
  selectedLlmModel?: string
  /** 当前选中的模型类型筛选 */
  selectedModelType?: string
  /** 语音播报是否启用 */
  voiceEnabled?: boolean
  /** 视频对话是否启用 */
  videoEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'chat',
  agents: () => [],
  workspaceIsActive: false,
  workspaceDirName: null,
  models: () => [],
  selectedLlmModel: 'mcp-llm',
  selectedModelType: 'llm',
  voiceEnabled: false,
  videoEnabled: false,
})

/**
 * 模型定义
 */
interface ModelItem {
  /** 模型ID */
  id: number
  /** 模型编码 */
  code: string
  /** 模型名称 */
  name: string
  /** 模型描述 */
  description?: string
  /** 状态 */
  status?: boolean
  /** 类型 */
  type?: string
}

const emit = defineEmits<{
  /** 发送消息 */
  send: [content: string]
  /** 停止生成 */
  stop: []
  /** 模式更新 */
  'update:mode': [value: 'chat' | 'rag' | 'retrieval']
  /** 模式变更 */
  'mode-change': [value: 'chat' | 'rag' | 'retrieval']
  /** 智能体变更 */
  'agent-change': [value: string]
  /** 工作目录选择 */
  'workspace-select': []
  /** 工作目录清除 */
  'workspace-clear': []
  /** 模型变更 */
  'llm-model-change': [value: string]
  /** 模型类型筛选变更 */
  'model-type-change': [value: string]
  /** 语音播报开关切换 */
  'voice-toggle': []
  /** 视频对话开关切换 */
  'video-toggle': []
  /** 文件上传 */
  'file-upload': [file: File, fileType: string]
}>()

/** 内部模型编码（用于本地响应式） */
const internalModelCode = ref<string>(props.selectedLlmModel)

/** 内部模型类型筛选（用于本地响应式） */
const internalModelType = ref<string>(props.selectedModelType)

/** 模型类型标签选项 */
const modelTypeOptions = [
  { value: 'llm', label: 'LLM', icon: '💬', description: '大语言模型' },
  { value: 'lmm', label: 'LMM', icon: '🖼️', description: '多模态模型' },
  { value: 'omni', label: 'OMNI', icon: '🌟', description: '全能多模态模型' },
]

/** 模型上拉面板是否显示 */
const showModelSheet = ref(false)
/** 模式上拉面板是否显示 */
const showModeSheet = ref(false)

/** 语音设置对话框引用 */
const voiceSettingsRef = ref<InstanceType<typeof VoiceSettings>>()

/** 文件选择器是否显示 */
const showFilePicker = ref(false)
/** 隐藏的文件输入框引用 */
const fileInputRef = ref<HTMLInputElement | null>()
/** 当前待上传的文件类型 */
const pendingFileType = ref('')

// ========== 摄像头状态 ==========

/** 摄像头预览面板是否显示 */
const showCameraPreview = ref(false)
/** 视频元素引用 */
const videoRef = ref<HTMLVideoElement | null>(null)
/** Canvas 元素引用 */
const canvasRef = ref<HTMLCanvasElement | null>(null)
/** 摄像头 Composables（帧捕获由定时器控制 2s 间隔，useCamera 内部 minFrameInterval 作为安全网） */
const camera = useCamera({
  hashSize: 8,
  similarityThreshold: 0.95,
  frameQuality: 0.7,
})
/** 最近捕获的帧数据 */
const latestFrame = ref<{ dataUrl: string; mimeType: string } | null>(null)
/** 帧捕获定时器 */
let frameTimer: ReturnType<typeof setInterval> | null = null
/** 摄像头是否已开启（音视频模式下可独立开关） */
const cameraActive = ref(false)

/**
 * 压缩帧数据 URL
 * 将 Base64 图片缩放至目标尺寸再重新编码，减少传输体积
 * @param dataUrl 原始帧数据 URL
 * @param maxWidth 目标最大宽度，默认 320
 * @param quality JPEG 质量，默认 0.6
 * @returns 压缩后的数据 URL
 */
function compressFrame(dataUrl: string, maxWidth = 320, quality = 0.6): string {
  const img = new Image()
  img.src = dataUrl
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, maxWidth / img.width)
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** 输入文本 */
const inputText = ref('')
/** 当前模式 */
const currentMode = ref<'chat' | 'rag' | 'retrieval'>(props.mode)
/** 选中的智能体 */
const selectedAgent = ref<string>('')
/** 输入框引用 */
const inputRef = ref<any>(null)
/** 斜杠命令菜单是否显示 */
const showCommandMenu = ref(false)
/** 斜杠命令当前选中索引 */
const commandIndex = ref(0)

// ========== 语音输入状态 ==========

/** 语音输入状态文本 */
const voiceStatusText = ref('')
/** 语音输入 Composable */
const voiceInput = useVoiceInput(
  // 识别成功：将文本填入输入框并自动发送
  (result) => {
    voiceStatusText.value = ''
    if (result.text.trim()) {
      inputText.value = result.text.trim()
      // 自动发送
      nextTick(() => handleSend())
    }
  },
  // 识别失败：显示错误提示
  (err) => {
    voiceStatusText.value = ''
    ElMessage.error(`语音识别失败: ${err}`)
  },
)
/** 是否正在录音 */
const isVoiceRecording = computed(() => voiceInput.status.value === 'recording')
/** 是否正在识别中 */
const isVoiceRecognizing = computed(() => voiceInput.status.value === 'recognizing')
/** 浏览器是否支持语音输入 */
const voiceSupported = computed(() => voiceInput.isSupported)

/**
 * 开始录音（鼠标按下）
 */
function handleVoicePress() {
  if (props.isLoading) return
  voiceInput.startRecording()
  voiceStatusText.value = '录音中...'
}

/**
 * 结束录音（鼠标松开/离开）
 */
function handleVoiceRelease() {
  if (voiceInput.status.value !== 'recording') return
  voiceStatusText.value = '识别中...'
  voiceInput.stopAndRecognize()
}

/**
 * 取消录音（鼠标移到按钮外）
 */
function handleVoiceCancel() {
  if (voiceInput.status.value === 'recording') {
    voiceInput.cancelRecording()
    voiceStatusText.value = ''
  }
}

/**
 * 斜杠命令列表
 */
const slashCommands: SlashCommand[] = [
  { name: 'chat', description: '切换到对话模式', action: () => handleModeChange('chat') },
  { name: 'rag', description: '切换到RAG问答模式', action: () => handleModeChange('rag') },
  { name: 'search', description: '切换到向量检索模式', action: () => handleModeChange('retrieval') },
  { name: 'clear', description: '清空当前对话', action: () => { inputText.value = '' } },
  { name: 'new', description: '新建对话', action: () => { inputText.value = '' } },
]

/**
 * 根据输入过滤斜杠命令
 */
const filteredCommands = computed(() => {
  if (!inputText.value.startsWith('/')) return []
  const query = inputText.value.slice(1).toLowerCase()
  return slashCommands.filter((cmd) => cmd.name.includes(query))
})

/**
 * 处理工作目录触发器点击
 */
const handleWorkspaceTrigger = () => {
  if (props.workspaceIsActive) {
    emit('workspace-select')
  } else {
    emit('workspace-select')
  }
}

watch(() => props.mode, (newMode) => {
  currentMode.value = newMode
})

/** 监听外部模型变更 */
watch(() => props.selectedLlmModel, (newVal) => {
  internalModelCode.value = newVal
})

/** 监听外部模型类型变更 */
watch(() => props.selectedModelType, (newVal) => {
  internalModelType.value = newVal
})

/**
 * 已启用的模型列表（按选中类型筛选）
 */
const enabledModels = computed(() => {
  return props.models.filter((m: ModelItem) => m.status === true && m.type === internalModelType.value)
})

/**
 * 当前模型类型标签文字
 */
const currentModelTypeLabel = computed(() => {
  const tab = modelTypeOptions.find((t) => t.value === internalModelType.value)
  return tab?.label || 'LLM'
})

/**
 * 当前模型显示名称
 */
const currentModelDisplayName = computed(() => {
  if (internalModelCode.value === 'mcp-llm' || !internalModelCode.value) {
    return 'Auto 智能调度'
  }
  const model = props.models.find((m: ModelItem) => m.code === internalModelCode.value)
  return model?.name || internalModelCode.value
})

/**
 * 当前选中智能体是否支持工作目录
 */
const selectedAgentSupportsWorkspace = computed(() => {
  if (!selectedAgent.value) return false
  const agent = props.agents.find((a: Agent) => a.id === selectedAgent.value)
  return agent?.supportsWorkspace === true
})

/**
 * 选择模型
 * @param code 模型编码
 */
const selectModel = (code: string) => {
  internalModelCode.value = code
  emit('llm-model-change', code)
  showModelSheet.value = false
}

/**
 * 切换模型类型筛选标签
 * @param modelType 模型类型
 */
const handleModelTypeTabChange = (modelType: string) => {
  internalModelType.value = modelType
  internalModelCode.value = 'mcp-llm'
  emit('model-type-change', modelType)
  emit('llm-model-change', 'mcp-llm')
}

/**
 * 当前模式显示图标
 */
const currentModeIcon = computed(() => {
  const item = modeOptions.find((m) => m.value === currentMode.value)
  return item?.icon || '💬'
})

/**
 * 当前模式显示标签
 */
const currentModeLabel = computed(() => {
  const item = modeOptions.find((m) => m.value === currentMode.value)
  return item?.label || '对话'
})

/** 模式选项 */
const modeOptions = [
  { value: 'chat' as const, label: '对话', icon: '💬', description: '直接与大模型对话交流' },
  { value: 'rag' as const, label: 'RAG', icon: '📚', description: '基于知识库进行检索增强问答' },
  { value: 'retrieval' as const, label: '检索', icon: '🔍', description: '纯向量检索，查看相关文档片段' },
]

/**
 * 处理键盘事件
 * @param e 键盘事件
 */
const handleKeydown = (e: KeyboardEvent) => {
  if (showCommandMenu.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      commandIndex.value = Math.min(commandIndex.value + 1, filteredCommands.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      commandIndex.value = Math.max(commandIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (filteredCommands.value.length > 0) {
        selectCommand(filteredCommands.value[commandIndex.value])
      }
      return
    }
    if (e.key === 'Escape') {
      showCommandMenu.value = false
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

/**
 * 处理输入变化
 */
const handleInput = () => {
  if (inputText.value.startsWith('/') && filteredCommands.value.length > 0) {
    showCommandMenu.value = true
    commandIndex.value = 0
  } else {
    showCommandMenu.value = false
  }
}

/**
 * 选择斜杠命令
 * @param cmd 命令对象
 */
const selectCommand = (cmd: SlashCommand) => {
  showCommandMenu.value = false
  inputText.value = ''
  cmd.action()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

/**
 * 发送消息
 * 如果摄像头已开启，自动附带当前摄像头帧（压缩后）
 */
const handleSend = () => {
  if (inputText.value.trim()) {
    let content = inputText.value
    // 摄像头已开启时，自动附带当前帧（压缩为 320px 宽以减少体积）
    if (cameraActive.value && latestFrame.value) {
      const compressed = compressFrame(latestFrame.value.dataUrl, 320, 0.6)
      content = `![camera-frame](${compressed})\n${content}`
    }
    emit('send', content)
    inputText.value = ''
    showCommandMenu.value = false
  }
}

/**
 * 处理模式切换
 * @param mode 目标模式
 */
const handleModeChange = (mode: 'chat' | 'rag' | 'retrieval') => {
  const wasChatMode = currentMode.value === 'chat'
  currentMode.value = mode
  if (mode !== 'chat') {
    selectedAgent.value = ''
  } else if (!wasChatMode) {
    emit('agent-change', selectedAgent.value)
  }
  emit('update:mode', mode)
  emit('mode-change', mode)
}

/**
 * 处理模式上拉面板选择
 * @param mode 目标模式
 */
const handleModeSheetSelect = (mode: 'chat' | 'rag' | 'retrieval') => {
  handleModeChange(mode)
  showModeSheet.value = false
}

/**
 * 处理智能体选择
 * @param agentId 智能体ID
 */
const handleAgentSelect = (agentId: string) => {
  selectedAgent.value = agentId
  emit('agent-change', agentId)
}

/**
 * 处理工作目录清除
 */
const handleWorkspaceClear = () => {
  emit('workspace-clear')
}

/**
 * 处理语音按钮点击
 * 左键点击切换开关，右键点击打开设置面板
 */
const handleVoiceClick = () => {
  emit('voice-toggle')
}

const handleVoiceSettings = () => {
  voiceSettingsRef.value?.open()
}

/**
 * 处理音视频对话主开关点击
 * 进入/退出音视频对话模式（TTS 语音 + 可选摄像头）
 * 进入时默认仅开启音频，不自动启动摄像头
 */
const handleVideoToggleClick = () => {
  if (props.videoEnabled) {
    if (!showCameraPreview.value) {
      // AV 模式已开启但弹窗被关闭 → 重新打开弹窗
      showCameraPreview.value = true
    } else {
      // 弹窗已打开 → 退出 AV 模式（关闭摄像头 + 关闭弹窗）
      stopCameraPreview()
      cameraActive.value = false
      emit('video-toggle')
    }
  } else {
    // 未在 AV 模式 → 进入（仅音频，弹出摄像头控制面板供用户选择）
    emit('video-toggle')
    cameraActive.value = false
    showCameraPreview.value = true
  }
}

/**
 * 独立开关摄像头（不退出音视频对话模式）
 * 在弹窗内调用，控制摄像头启停
 */
const handleCameraToggle = async () => {
  if (cameraActive.value) {
    // 关闭摄像头（保留弹窗打开）
    stopCameraCapture()
    cameraActive.value = false
  } else {
    // 开启摄像头
    cameraActive.value = true
    await startCameraPreview()
  }
}

/**
 * 启动摄像头预览
 * 打开摄像头、绑定视频元素、开始定时帧捕获
 */
const startCameraPreview = async () => {
  // 确保弹窗已打开
  showCameraPreview.value = true
  await nextTick()

  // 绑定视频和 Canvas 元素
  if (videoRef.value) {
    camera.setVideoElement(videoRef.value)
  }
  if (canvasRef.value) {
    camera.setCanvasElement(canvasRef.value)
  }

  // 启动摄像头（视频 + 音频）
  const success = await camera.startCamera({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: true,
  })

  if (success) {
    // 启动定时帧捕获（每 2 秒）
    startFrameCapture()
  } else {
    // 启动失败时保持弹窗打开，重置状态
    cameraActive.value = false
    ElMessage.error(camera.error.value || '摄像头启动失败，请检查权限')
  }
}

/**
 * 停止摄像头捕获（保留弹窗打开）
 * 由 handleCameraToggle（关闭摄像头）调用
 */
const stopCameraCapture = () => {
  stopFrameCapture()
  camera.stopCamera()
  latestFrame.value = null
}

/**
 * 停止摄像头预览并关闭弹窗
 * 由 handleVideoToggleClick（退出AV模式）调用
 */
const stopCameraPreview = () => {
  stopCameraCapture()
  showCameraPreview.value = false
}

/**
 * 启动定时帧捕获
 * 每 2 秒捕获一帧，自动去重
 * 仅在摄像头活跃时更新 latestFrame
 */
const startFrameCapture = () => {
  stopFrameCapture()
  frameTimer = setInterval(() => {
    const frame = camera.captureFrame()
    if (frame) {
      latestFrame.value = frame
    }
  }, 2000)
}

/**
 * 停止定时帧捕获
 */
const stopFrameCapture = () => {
  if (frameTimer) {
    clearInterval(frameTimer)
    frameTimer = null
  }
}

/**
 * 选择文件类型，触发原生文件选择器
 * @param accept 允许的文件类型
 * @param fileType 文件类别（image/video/file）
 */
const selectFileType = (accept: string, fileType: string) => {
  pendingFileType.value = fileType
  if (fileInputRef.value) {
    fileInputRef.value.accept = accept
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
  showFilePicker.value = false
}

/**
 * 处理文件选择完成
 * @param e 事件对象
 */
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('file-upload', target.files[0], pendingFileType.value)
  }
}

/**
 * 获取输入框占位文本
 * @returns 占位文本
 */
const getPlaceholder = (): string => {
  if (currentMode.value === 'chat' && selectedAgent.value) {
    return '输入消息与智能体对话... (输入 / 查看命令)'
  }
  switch (currentMode.value) {
    case 'chat': return '输入消息开始对话... (输入 / 查看命令)'
    case 'rag': return '输入问题，基于知识库进行问答...'
    case 'retrieval': return '输入关键词进行向量检索...'
    default: return '输入消息...'
  }
}

/** 摄像头是否正在捕获 */
const isCapturing = computed(() => camera.isCapturing.value)

/* ===== 弹窗拖拽 ===== */
/** 弹窗累计偏移量 */
const panelOffsetX = ref(0)
const panelOffsetY = ref(0)
/** 是否正在拖拽 */
const isDragging = ref(false)
/** 拖拽起始位置 */
let dragStartX = 0
let dragStartY = 0
/** 拖拽起始偏移量（用于累加） */
let dragOriginX = 0
let dragOriginY = 0

/**
 * 拖拽开始（在 header 上 mousedown）
 * @param e 鼠标事件
 */
const handlePanelDragStart = (e: MouseEvent) => {
  // 仅左键拖拽，不响应按钮/输入框等交互元素
  if (e.button !== 0 || (e.target as HTMLElement)?.closest('button, input, .el-button')) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOriginX = panelOffsetX.value
  dragOriginY = panelOffsetY.value
  document.addEventListener('mousemove', handlePanelDragMove)
  document.addEventListener('mouseup', handlePanelDragEnd)
}

/** 拖拽移动 */
const handlePanelDragMove = (e: MouseEvent) => {
  panelOffsetX.value = dragOriginX + (e.clientX - dragStartX)
  panelOffsetY.value = dragOriginY + (e.clientY - dragStartY)
}

/** 拖拽结束 */
const handlePanelDragEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handlePanelDragMove)
  document.removeEventListener('mouseup', handlePanelDragEnd)
}

/** 组件卸载时清理摄像头资源 */
onBeforeUnmount(() => {
  stopCameraPreview()
  handlePanelDragEnd() // 清理拖拽监听器
})
</script>

<style lang="scss" scoped>
.chat-input {
  padding: 16px 24px 24px;
  background: var(--white);
  border-top: 1px solid var(--border-color);
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}

.agent-chips-bar {
  margin-bottom: 10px;
  overflow: hidden;
}

.agent-chips-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.agent-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;

  &:hover {
    color: var(--primary-color);
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }

  &.active {
    background: var(--primary-gradient);
    color: white;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);

    .el-icon {
      color: white;
    }
  }
}

.command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover,
  &.active {
    background: var(--bg-color);
  }
}

.command-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  min-width: 80px;
}

.command-desc {
  font-size: 13px;
  color: var(--text-tertiary);
}

.input-container {
  position: relative;
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.input-bottom-bar {
  display: flex;
  align-items: center;
  padding: 6px 16px 0;
}

.bottom-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.bottom-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}

.voice-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-tertiary);

  &:hover {
    background: var(--bg-tertiary);
    color: var(--primary-color);
  }

  &.voice-active {
    color: var(--primary-color);
  }
}

.voice-trigger-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  border: 2px solid var(--white);
  transition: all 0.2s ease;

  &.active {
    background: #67c23a;
    box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
  }
}

.video-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-tertiary);

  &:hover {
    background: var(--bg-tertiary);
    color: var(--primary-color);
  }

  &.video-active {
    color: var(--primary-color);
  }
}

.video-trigger-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  border: 2px solid var(--white);
  transition: all 0.2s ease;

  &.active {
    background: #e6a23c;
    box-shadow: 0 0 4px rgba(230, 162, 60, 0.5);
  }
}

.upload-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-tertiary);

  &:hover {
    background: var(--bg-tertiary);
    color: var(--primary-color);
  }
}

.file-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.file-sheet-panel {
  width: 100%;
  max-width: 400px;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  margin: 0 20px;
}

.file-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.file-sheet-close {
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color 0.2s;

  &:hover {
    color: var(--text-color);
  }
}

.file-sheet-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-secondary);
  }
}

.file-sheet-emoji {
  font-size: 28px;
  line-height: 1;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.file-sheet-info {
  flex: 1;
  min-width: 0;
}

.file-sheet-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.file-sheet-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.file-sheet-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-sheet-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-sheet-enter-from,
.file-sheet-leave-to {
  opacity: 0;

  .file-sheet-panel {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
}

.file-sheet-enter-to,
.file-sheet-leave-from {
  opacity: 1;
}

.model-trigger,
.workspace-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }

  .el-icon {
    color: var(--primary-color);
    flex-shrink: 0;
  }
}

.model-trigger-text,
.workspace-trigger-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-trigger {
  border-style: dashed;
  border-color: var(--border-color);

  &:hover {
    border-style: solid;
    border-color: var(--primary-color);
  }

  .el-icon {
    color: #67c23a;
  }
}

.workspace-trigger-clear {
  color: var(--text-tertiary) !important;
  transition: color 0.2s;
  padding: 2px;
  border-radius: 50%;

  &:hover {
    color: #f56c6c !important;
    background: rgba(245, 108, 108, 0.1);
  }
}

.model-trigger-arrow {
  color: var(--text-tertiary) !important;
  transition: color 0.2s;
}

.model-trigger:hover .model-trigger-arrow {
  color: var(--primary-color) !important;
}

.model-type-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--primary-color);
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.4;
}

.model-type-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 14px 4px;
}

.model-type-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  user-select: none;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;

    .model-type-tab-label {
      color: #fff;
    }
  }
}

.model-type-tab-icon {
  font-size: 14px;
  line-height: 1;
}

.model-type-tab-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.mode-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-color);
  }
}

.mode-trigger-icon {
  font-size: 14px;
  line-height: 1;
}

.mode-trigger-text {
  font-size: 12px;
  color: var(--text-color);
  font-weight: 600;
}

.mode-trigger-arrow {
  color: rgba(255, 255, 255, 0.7) !important;
}

.mode-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.mode-sheet-panel {
  width: 100%;
  max-width: 420px;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  margin: 0 20px;
}

.mode-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.mode-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.mode-sheet-close {
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color 0.2s;

  &:hover {
    color: var(--text-color);
  }
}

.mode-sheet-body {
  padding: 8px;
}

.mode-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    background: var(--bg-secondary);
  }

  &.active {
    background: var(--bg-color);
    border-color: var(--primary-color);
  }
}

.mode-sheet-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mode-sheet-emoji {
  font-size: 24px;
  line-height: 1;
}

.mode-icon-chat {
  background: linear-gradient(135deg, #e8f0ff 0%, #d4e0ff 100%);
}

.mode-icon-rag {
  background: linear-gradient(135deg, #fff3e6 0%, #ffe8cc 100%);
}

.mode-icon-retrieval {
  background: linear-gradient(135deg, #f0f9eb 0%, #e0f5d8 100%);
}

html.dark {
  .mode-icon-chat {
    background: linear-gradient(135deg, #1a2540 0%, #1e3050 100%);
  }

  .mode-icon-rag {
    background: linear-gradient(135deg, #3d2e0a 0%, #4a3510 100%);
  }

  .mode-icon-retrieval {
    background: linear-gradient(135deg, #1a2e15 0%, #1f3a18 100%);
  }
}

.mode-sheet-info {
  flex: 1;
  min-width: 0;
}

.mode-sheet-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.mode-sheet-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.mode-sheet-check {
  color: var(--primary-color);
  flex-shrink: 0;
}

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: all 0.25s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;

  .mode-sheet-panel {
    transform: translateY(30px);
  }
}

.model-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.model-sheet-panel {
  width: 100%;
  max-width: 500px;
  max-height: 70vh;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  margin: 0 20px;
}

.model-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.model-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.model-sheet-close {
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color 0.2s;
  flex-shrink: 0;

  &:hover {
    color: var(--text-color);
  }
}

.model-sheet-body {
  overflow-y: auto;
  padding: 8px;
  flex: 1;
}

.model-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    background: var(--bg-secondary);
  }

  &.active {
    background: var(--bg-color);
    border-color: var(--primary-color);
  }
}

.model-sheet-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--primary-color);
  flex-shrink: 0;

  &.mcp-icon {
    background: linear-gradient(135deg, #fff3e6 0%, #ffe8cc 100%);
    color: #f59e0b;
  }
}

html.dark .model-sheet-icon.mcp-icon {
  background: linear-gradient(135deg, #3d2e0a 0%, #4a3510 100%);
  color: #fbbf24;
}

.model-sheet-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.model-sheet-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.model-sheet-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.model-sheet-check {
  color: var(--primary-color);
  flex-shrink: 0;
}

.model-sheet-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }

  span {
    font-size: 12px;
    color: var(--text-tertiary);
    white-space: nowrap;
  }
}

.model-sheet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.model-sheet-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.model-sheet-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.model-sheet-enter-from,
.model-sheet-leave-to {
  opacity: 0;

  .model-sheet-panel {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
}

.model-sheet-enter-to,
.model-sheet-leave-from {
  opacity: 1;
}

.input-actions {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  align-items: center;

  .el-button {
    padding: 0;
    width: 44px;
    height: 44px;
  }
}

:deep(.el-textarea__inner) {
  padding: 16px 70px 16px 20px;
  border-radius: var(--radius-lg);
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  background: var(--white);
  color: var(--text-color);

  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }
}

:deep(.el-button--primary) {
  background: var(--primary-gradient);
  border: none;
  width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
  }

  &:disabled {
    background: var(--bg-tertiary);
    box-shadow: none;
  }
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #f56c6c 0%, #e6474b 100%);
  border: none;
  width: 44px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
  }
}

@media (max-width: 768px) {
  .chat-input {
    padding: 12px 16px 16px;
  }

  .mode-selector-bar {
    flex-direction: column;
    gap: 8px;
  }

  .mode-tabs {
    width: 100%;
    justify-content: center;
  }

  .mode-tab {
    padding: 6px 12px;
  }

  .mode-label {
    font-size: 12px;
  }

  .workspace-agent-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-section {
    width: 100%;
  }
}

/* ========== 摄像头预览面板 ========== */

.video-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: transparent;
  pointer-events: none;
  padding-bottom: 16px;
}

.video-sheet-panel {
  width: 100%;
  max-width: 480px;
  background: var(--white);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  margin: 0 12px;
  pointer-events: auto;
  will-change: transform;
}

.video-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}

.video-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.video-sheet-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.video-sheet-body {
  position: relative;
  background: var(--bg-color, #f5f7fa);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

/* 摄像头控制行（弹窗内开关按钮） */
.camera-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-color, #f5f7fa);
  box-sizing: border-box;
}

.camera-control-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

/* 摄像头未开启时的占位提示 */
.camera-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
  flex: 1;
  min-height: 240px;
}

.camera-preview-placeholder p {
  margin: 0;
}

.camera-hint {
  font-size: 12px;
  opacity: 0.7;
}

.camera-preview-area {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 0 0 16px 16px;
}

.camera-canvas {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.video-sheet-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-sheet-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-sheet-enter-from,
.video-sheet-leave-to {
  opacity: 0;

  .video-sheet-panel {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
}

.video-sheet-enter-to,
.video-sheet-leave-from {
  opacity: 1;
}

/* ========== 语音输入按钮 ========== */

.attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-tertiary, #f0f2f5);
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.attach-btn:hover {
  background: var(--bg-secondary, #e8eaed);
  color: var(--text-color, #333);
  transform: scale(1.05);
}

.voice-input-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-tertiary, #f0f2f5);
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.25s ease;
  justify-content: center;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.voice-input-btn:hover {
  background: var(--bg-secondary, #e8eaed);
  color: var(--text-color, #333);
}

.voice-input-btn:active,
.voice-input-btn.is-recording {
  background: linear-gradient(135deg, #f56c6c 0%, #e6474b 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(245, 108, 108, 0.5);
  transform: scale(1.05);
}

.voice-input-btn.is-recording .el-icon {
  animation: voice-pulse 1s ease-in-out infinite;
}

.voice-input-btn.is-recognizing {
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  color: #fff;
  pointer-events: none;
}

.voice-input-btn.is-recognizing .el-icon {
  animation: voice-spin 1s linear infinite;
}

.voice-status-text {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-secondary, #666);
  background: var(--bg-color, #fff);
  padding: 2px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

@keyframes voice-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

@keyframes voice-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

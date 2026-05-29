<template>
  <el-drawer
    :model-value="visible"
    :title="testType === 'tts' ? $t('model.voiceTestTitle') : $t('model.asrTestTitle')"
    :size="560"
    @close="handleClose"
  >
    <template v-if="testType === 'tts'">
      <!-- 能力提示 -->
      <el-alert
        v-if="capabilityMessage"
        :title="capabilityMessage"
        :type="capabilityAlertType"
        :closable="false"
        show-icon
        class="capability-tip"
      >
        <template #default>
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <el-tag v-if="capability.supportsRealtime" type="success" size="small" effect="plain">
              <el-icon><Connection /></el-icon> {{ $t('model.realtimeTitle') }} ✓
            </el-tag>
            <el-tag v-if="capability.supportsNonRealtime" type="success" size="small" effect="plain">
              <el-icon><Timer /></el-icon> {{ $t('model.nonRealtimeTitle') }} ✓
            </el-tag>
          </div>
        </template>
      </el-alert>

      <!-- 通用输入区域 -->
      <el-form label-width="80px" label-position="top">
        <el-form-item :label="$t('model.testInputText')">
          <el-input
            v-model="ttsText"
            type="textarea"
            :rows="3"
            :placeholder="$t('model.testInputPlaceholder')"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('model.voiceType')">
              <el-select v-model="ttsVoice" style="width: 100%;" :loading="voicesLoading" @change="handleVoiceChange">
                <el-option
                  v-if="voiceOptions.length === 0 && !voicesLoading"
                  label="Cherry (女声)"
                  value="Cherry"
                />
                <el-option
                  v-for="voice in voiceOptions"
                  :key="voice.voiceId"
                  :label="voiceLabel(voice)"
                  :value="voice.voiceId"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('model.voiceSpeed')">
              <el-slider
                v-model="ttsSpeed"
                :min="0.5"
                :max="2"
                :step="0.1"
                :format-tooltip="(val: number) => `${val}x`"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- 模式卡片容器 -->
      <div class="tts-modes">
        <!-- 非实时语音合成 -->
        <div class="mode-card" :class="{ 'mode-card--disabled': !capability.supportsNonRealtime }">
          <div class="mode-card__header">
            <div class="mode-card__title">
              <el-icon class="mode-card__icon"><Timer /></el-icon>
              <span>{{ $t('model.nonRealtimeTitle') }}</span>
            </div>
            <el-tag v-if="capability.supportsNonRealtime" type="success" size="small" effect="plain">{{ $t('model.supported') }}</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">{{ $t('model.unsupported') }}</el-tag>
          </div>
          <div class="mode-card__desc">{{ $t('model.nonRealtimeDesc') }}</div>

          <div class="mode-card__actions">
            <el-button
              type="primary"
              :loading="nonRealtimeLoading"
              :disabled="!ttsText.trim() || !capability.supportsNonRealtime"
              @click="handleDirectSynthesis"
            >
              {{ $t('model.testSynthesize') }}
            </el-button>
          </div>

          <div v-if="nonRealtimeResult" class="test-result">
            <div class="result-header">
              <span class="result-label">{{ $t('model.testPlayback') }}</span>
              <el-tag size="small">{{ nonRealtimeResult.format }}</el-tag>
            </div>
            <audio v-if="nonRealtimeAudioUrl" :src="nonRealtimeAudioUrl" controls class="audio-player" />
            <div v-if="nonRealtimeResult.duration" class="result-info">
              {{ $t('model.audioDuration') }}: {{ nonRealtimeResult.duration.toFixed(1) }}s
            </div>
          </div>
        </div>

        <!-- 实时语音合成（WebSocket 流式） -->
        <div class="mode-card" :class="{ 'mode-card--disabled': !capability.supportsRealtime }">
          <div class="mode-card__header">
            <div class="mode-card__title">
              <el-icon class="mode-card__icon"><Connection /></el-icon>
              <span>{{ $t('model.realtimeTitle') }}</span>
            </div>
            <el-tag v-if="capability.supportsRealtime" type="success" size="small" effect="plain">{{ $t('model.supported') }}</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">{{ $t('model.unsupported') }}</el-tag>
          </div>
          <div class="mode-card__desc">{{ $t('model.realtimeDesc') }}</div>

          <!-- 合成状态 -->
          <div class="streaming-status-bar">
            <span class="status-label">{{ $t('model.streamingStatus') }}:</span>
            <el-tag :type="wsStatusTagType" size="small" class="status-tag">
              {{ wsStatusText }}
            </el-tag>
            <span v-if="wsChunkCount > 0" class="chunk-count">
              {{ $t('model.streamingChunks') }}: {{ wsChunkCount }}
              <span v-if="wsPlaying" class="playing-indicator">▶ {{ $t('model.streamingPlaying') }}</span>
            </span>
          </div>

          <div class="mode-card__actions streaming-actions">
            <el-button
              type="primary"
              :loading="wsStarting"
              :disabled="!ttsText.trim() || !capability.supportsRealtime || wsStatus === 'connected'"
              @click="handleStreamStart"
            >
              {{ $t('model.realtimeStart') }}
            </el-button>
            <el-button
              type="danger"
              :disabled="wsStatus !== 'connected'"
              @click="handleStreamStop"
            >
              {{ $t('model.realtimeStop') }}
            </el-button>
          </div>

          <div v-if="wsResultAudioUrl" class="test-result">
            <div class="result-header">
              <span class="result-label">{{ $t('model.testPlayback') }}</span>
              <el-tag size="small">{{ wsAudioFormat }}</el-tag>
            </div>
            <audio :src="wsResultAudioUrl" controls class="audio-player" />
            <div class="result-info">
              {{ $t('model.streamingChunks') }}: {{ wsChunkCount }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- ASR 测试区域 -->
      <el-form label-width="80px" label-position="top">
        <el-form-item :label="$t('model.testUploadAudio')">
          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="true"
            accept="audio/*"
            :on-change="handleAudioFileChange"
            :limit="1"
            :file-list="asrFileList"
          >
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">{{ $t('model.testUploadHint') }}</div>
          </el-upload>
        </el-form-item>

        <el-form-item :label="$t('model.audioFormat')">
          <el-select v-model="asrFormat" style="width: 100%;">
            <el-option label="WAV" value="wav" />
            <el-option label="MP3" value="mp3" />
            <el-option label="OGG" value="ogg" />
            <el-option label="FLAC" value="flac" />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="test-actions">
        <el-button type="primary" :loading="asrLoading" @click="handleASR" :disabled="!asrAudioFile">
          {{ $t('model.testRecognize') }}
        </el-button>
      </div>

      <div v-if="asrResult" class="test-result">
        <div class="result-header">
          <span class="result-label">{{ $t('model.testRecognitionResult') }}</span>
          <el-tag v-if="asrResult.confidence" type="success" size="small">
            {{ $t('model.testConfidence') }}: {{ (asrResult.confidence * 100).toFixed(1) }}%
          </el-tag>
        </div>
        <div class="result-text">{{ asrResult.text }}</div>
        <div v-if="asrResult.language" class="result-info">
          {{ $t('model.testLanguage') }}: {{ asrResult.language }}
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="handleClose">{{ $t('common.close') }}</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Timer, Connection } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import { adminRequest } from '@/utils/request'
import { voiceProfileApi, type VoiceProfile } from '@/api/voice-profile'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  visible: boolean
  testType: 'tts' | 'asr'
  modelCode?: string
}>(), {
  visible: false,
  testType: 'tts',
  modelCode: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

/** TTS通用输入 */
const ttsText = ref('你好，欢迎使用语音合成测试。')
const ttsVoice = ref('Cherry')
const ttsSpeed = ref(1.0)

/** 语音配置选项 */
const voiceOptions = ref<VoiceProfile[]>([])
const voicesLoading = ref(false)

/** TTS能力查询结果 */
const capability = ref<{
  supportsRealtime: boolean
  supportsNonRealtime: boolean
  provider?: string
}>({
  supportsRealtime: false,
  supportsNonRealtime: true,
})
const capabilityMessage = ref('')
const capabilityAlertType = ref<'info' | 'warning' | 'success'>('info')

/** 非实时语音合成状态 */
const nonRealtimeLoading = ref(false)
const nonRealtimeResult = ref<{ format: string; duration?: number } | null>(null)
const nonRealtimeAudioUrl = ref<string>('')

/** WebSocket 流式合成状态（实时 + 批量统一） */
const wsSocket = ref<Socket | null>(null)
const wsConversationId = ref('')
const wsStatus = ref<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
const wsStarting = ref(false)
const wsChunkCount = ref(0)
const wsPlaying = ref(false)
const wsPcmChunks = ref<string[]>([])
const wsResultAudioUrl = ref('')
const wsAudioFormat = ref('wav')

/** Web Audio API 实时播放 */
let audioContext: AudioContext | null = null
let nextChunkTime = 0

/** WebSocket 状态标签类型 */
const wsStatusTagType = computed(() => {
  const map: Record<string, 'info' | 'success' | 'danger' | 'warning'> = {
    idle: 'info', connecting: 'warning', connected: 'success', disconnected: 'danger',
  }
  return map[wsStatus.value] || 'info'
})

/** WebSocket 状态显示文本 */
const wsStatusText = computed(() => {
  const map: Record<string, string> = {
    idle: t('model.streamingDisconnected'),
    connecting: t('model.streamingConnecting'),
    connected: t('model.streamingConnected'),
    disconnected: t('model.streamingDisconnected'),
  }
  return map[wsStatus.value] || ''
})

/**
 * 加载语音配置列表
 */
async function loadVoices() {
  voicesLoading.value = true
  try {
    const response = await voiceProfileApi.getList({ pageSize: 100, status: 'true' })
    const data = response.data?.data
    if (data?.list && data.list.length > 0) {
      voiceOptions.value = data.list
      ttsVoice.value = data.list[0].voiceId
    } else {
      voiceOptions.value = []
    }
  } catch {
    voiceOptions.value = []
  } finally {
    voicesLoading.value = false
  }
}

/**
 * 查询当前模型/语音的TTS能力
 */
async function queryCapability() {
  try {
    const response = await adminRequest.post('/api/admin/ai/tts/capability', {
      modelCode: props.modelCode || undefined,
      voice: ttsVoice.value,
    })
    const data = response.data?.data
    if (data) {
      capability.value = {
        supportsRealtime: !!data.supportsRealtime,
        supportsNonRealtime: data.supportsNonRealtime !== false,
        provider: data.provider,
      }
      if (data.message) {
        capabilityMessage.value = data.message
        capabilityAlertType.value = 'warning'
      } else if (data.supportsRealtime && data.supportsNonRealtime) {
        capabilityMessage.value = t('model.bothModesSupported')
        capabilityAlertType.value = 'success'
      } else if (data.supportsRealtime) {
        capabilityMessage.value = t('model.realtimeOnlySupported')
        capabilityAlertType.value = 'info'
      } else {
        capabilityMessage.value = t('model.nonRealtimeOnlySupported')
        capabilityAlertType.value = 'info'
      }
    }
  } catch {
    capability.value = { supportsRealtime: false, supportsNonRealtime: true }
    capabilityMessage.value = ''
  }
}

/**
 * 语音切换时重新查询能力
 */
function handleVoiceChange() {
  queryCapability()
}

/**
 * 获取语音配置显示标签
 * @param voice 语音配置
 * @returns {string} 显示标签
 */
function voiceLabel(voice: VoiceProfile): string {
  const genderMap: Record<string, string> = {
    male: t('voice.male'), female: t('voice.female'), neutral: t('voice.neutral'),
  }
  const gender = voice.gender ? ` (${genderMap[voice.gender] || voice.gender})` : ''
  const model = voice.modelCode ? ` [${voice.modelCode}]` : ''
  return `${voice.name}${gender}${model} - ${voice.provider}`
}

/** 监听抽屉打开时加载数据和查询能力 */
watch(() => props.visible, (val) => {
  if (val && props.testType === 'tts') {
    loadVoices().then(() => queryCapability())
  }
})

/**
 * 非实时直接合成
 * 调用 /api/admin/ai/tts 接口，返回完整的 Base64 音频数据
 */
async function handleDirectSynthesis() {
  if (!ttsText.value.trim()) return

  nonRealtimeLoading.value = true
  nonRealtimeResult.value = null
  nonRealtimeAudioUrl.value = ''

  try {
    const response = await adminRequest.post('/api/admin/ai/tts', {
      text: ttsText.value,
      voice: ttsVoice.value,
      speed: ttsSpeed.value,
      modelCode: props.modelCode || undefined,
    })

    const data = response.data?.data
    if (data?.audioData) {
      const audioBlob = base64ToBlob(data.audioData, data.format || 'mp3')
      nonRealtimeAudioUrl.value = URL.createObjectURL(audioBlob)
    }

    nonRealtimeResult.value = { format: data?.format || 'mp3', duration: data?.duration }
    ElMessage.success(t('model.testSuccess'))
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '语音合成失败')
  } finally {
    nonRealtimeLoading.value = false
  }
}

/**
 * 连接 WebSocket 并触发流式合成
 */
async function handleStreamStart() {
  if (!ttsText.value.trim() || wsSocket.value) return

  wsStarting.value = true
  wsChunkCount.value = 0
  wsPcmChunks.value = []
  wsResultAudioUrl.value = ''
  wsAudioFormat.value = 'wav'
  wsConversationId.value = crypto.randomUUID()
  wsStatus.value = 'connecting'

  try {
    const socket = io('/tts', {
      query: {
        conversationId: wsConversationId.value,
        voiceId: ttsVoice.value,
        speed: ttsSpeed.value.toString(),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    socket.on('connect_error', (error) => {
      console.error('[TTS-WS] 连接错误:', error.message)
      ElMessage.error(`WebSocket 连接失败: ${error.message}`)
      wsStatus.value = 'idle'
      wsStarting.value = false
    })

    setTimeout(() => {
      if (wsStatus.value === 'connecting') {
        ElMessage.warning('WebSocket 连接超时，请检查后端服务是否启动')
        wsStatus.value = 'idle'
        wsStarting.value = false
        socket.disconnect()
      }
    }, 15000)

    socket.on('connect', () => {
      console.log('[TTS-WS] 连接成功:', socket.id)
      wsStatus.value = 'connected'
      wsStarting.value = false
      triggerRealtimeSynthesis()
    })

    socket.on('audio_chunk', (chunk: { data: string; format: string; sequence: number; isLast: boolean }) => {
      wsChunkCount.value++
      if (chunk.format === 'pcm') {
        wsPcmChunks.value.push(chunk.data)
        playPCMChunk(chunk.data)
      }
    })

    socket.on('tts_start', () => {
      stopAudioPlayback()
      wsPcmChunks.value = []
      wsChunkCount.value = 0
      wsPlaying.value = false
    })

    socket.on('tts_end', () => {
      assembleAndPlayAudio()
    })

    socket.on('tts_error', (err: { message: string }) => {
      console.error('[TTS-WS] TTS 错误:', err.message)
      ElMessage.error(`TTS 错误: ${err.message}`)
      socket.disconnect()
      wsStatus.value = 'idle'
    })

    socket.on('error', (err: { message: string }) => {
      console.error('[TTS-WS] WebSocket 错误:', err.message)
      ElMessage.error(`WebSocket 错误: ${err.message}`)
      socket.disconnect()
      wsStatus.value = 'idle'
    })

    socket.on('disconnect', (reason) => {
      console.log('[TTS-WS] 断开连接:', reason)
      if (wsStatus.value === 'connected') {
        wsStatus.value = 'disconnected'
      }
    })

    wsSocket.value = socket
  } catch (error: any) {
    ElMessage.error(`连接失败: ${error.message}`)
    wsStatus.value = 'idle'
  } finally {
    wsStarting.value = false
  }
}

/**
 * 触发服务端实时流式合成
 */
async function triggerRealtimeSynthesis() {
  try {
    await adminRequest.post('/api/admin/ai/tts/realtime', {
      text: ttsText.value,
      conversationId: wsConversationId.value,
      voice: ttsVoice.value,
      speed: ttsSpeed.value,
      modelCode: props.modelCode || undefined,
    })
  } catch (error: any) {
    ElMessage.error(`触发实时合成失败: ${error.response?.data?.message || error.message}`)
    handleStreamStop()
  }
}

/**
 * 停止流式合成
 */
function handleStreamStop() {
  stopAudioPlayback()
  if (wsSocket.value) {
    wsSocket.value.disconnect()
    wsSocket.value = null
  }
  wsStatus.value = 'idle'
  assembleAndPlayAudio()
}

/**
 * 实时播放PCM音频块（Web Audio API）
 * @param base64Data PCM音频数据（base64编码，16位单声道）
 */
function playPCMChunk(base64Data: string) {
  if (!base64Data) return

  if (!audioContext) {
    audioContext = new AudioContext()
    nextChunkTime = 0
  }

  const binary = atob(base64Data)
  const sampleCount = Math.floor(binary.length / 2)
  if (sampleCount === 0) return

  const pcmData = new Int16Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    pcmData[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
  }

  const floatData = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    floatData[i] = pcmData[i] / 32768
  }

  const buffer = audioContext.createBuffer(1, sampleCount, 24000)
  buffer.getChannelData(0).set(floatData)

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(audioContext.destination)

  const now = audioContext.currentTime
  const startTime = Math.max(nextChunkTime, now)
  source.start(startTime)
  nextChunkTime = startTime + buffer.duration

  wsPlaying.value = true
}

/**
 * 停止Web Audio API播放
 */
function stopAudioPlayback() {
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  nextChunkTime = 0
  wsPlaying.value = false
}

/**
 * 组装所有PCM块为WAV并播放
 */
function assembleAndPlayAudio() {
  if (wsPcmChunks.value.length === 0) return

  if (wsResultAudioUrl.value) {
    URL.revokeObjectURL(wsResultAudioUrl.value)
    wsResultAudioUrl.value = ''
  }

  const allPcm = wsPcmChunks.value.join('')
  const audioBlob = pcmToWavBlob(allPcm, 24000)
  wsAudioFormat.value = 'wav'
  wsResultAudioUrl.value = URL.createObjectURL(audioBlob)
  ElMessage.success(t('model.testSuccess'))
}

/** ASR状态 */
const asrAudioFile = ref<File | null>(null)
const asrFileList = ref<any[]>([])
const asrFormat = ref('wav')
const asrLoading = ref(false)
const asrResult = ref<{ text: string; confidence?: number; language?: string } | null>(null)

/**
 * ASR语音识别测试
 */
async function handleASR() {
  if (!asrAudioFile.value) return

  asrLoading.value = true
  asrResult.value = null

  try {
    const reader = new FileReader()
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(asrAudioFile.value!)
    })

    const response = await adminRequest.post('/api/admin/ai/asr', {
      audio: base64,
      format: asrFormat.value,
      modelCode: props.modelCode || undefined,
    })

    const data = response.data?.data
    asrResult.value = {
      text: data?.text || '',
      confidence: data?.confidence,
      language: data?.language,
    }
    ElMessage.success(t('model.testSuccess'))
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '语音识别失败')
  } finally {
    asrLoading.value = false
  }
}

/**
 * 音频文件选择
 * @param file 文件对象
 */
function handleAudioFileChange(file: any) {
  asrAudioFile.value = file.raw
  asrFileList.value = [file]
}

/**
 * PCM转WAV Blob
 * @param base64 PCM数据(base64)
 * @param sampleRate 采样率
 * @returns {Blob} WAV音频Blob
 */
function pcmToWavBlob(base64: string, sampleRate: number): Blob {
  const binaryString = atob(base64)
  const pcmData = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    pcmData[i] = binaryString.charCodeAt(i)
  }

  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = pcmData.length
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < pcmData.length; i++) {
    view.setUint8(headerSize + i, pcmData[i])
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Base64转Blob
 * @param base64 Base64字符串
 * @param format 音频格式
 * @returns {Blob} 音频Blob
 */
function base64ToBlob(base64: string, format: string): Blob {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`
  return new Blob([bytes], { type: mimeType })
}

/**
 * 关闭
 */
function handleClose() {
  stopAudioPlayback()
  if (wsSocket.value) {
    wsSocket.value.disconnect()
    wsSocket.value = null
  }
  wsStatus.value = 'idle'
  wsPcmChunks.value = []
  if (nonRealtimeAudioUrl.value) {
    URL.revokeObjectURL(nonRealtimeAudioUrl.value)
    nonRealtimeAudioUrl.value = ''
  }
  if (wsResultAudioUrl.value) {
    URL.revokeObjectURL(wsResultAudioUrl.value)
    wsResultAudioUrl.value = ''
  }
  emit('update:visible', false)
}

/** 组件卸载时清理资源 */
onUnmounted(() => {
  stopAudioPlayback()
  if (wsSocket.value) {
    wsSocket.value.disconnect()
  }
  if (nonRealtimeAudioUrl.value) {
    URL.revokeObjectURL(nonRealtimeAudioUrl.value)
  }
  if (wsResultAudioUrl.value) {
    URL.revokeObjectURL(wsResultAudioUrl.value)
  }
})
</script>

<style scoped>
.capability-tip {
  margin-bottom: 16px;
}

.tts-modes {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
}

.mode-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: border-color 0.3s, opacity 0.3s;
}

.mode-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.mode-card--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-card--disabled:hover {
  border-color: var(--el-border-color-light);
}

.mode-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.mode-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mode-card__icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.mode-card__desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  line-height: 1.4;
}

.mode-card__actions {
  margin-bottom: 12px;
}

.streaming-actions {
  display: flex;
  gap: 8px;
}

.streaming-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
}

.status-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.status-tag {
  flex-shrink: 0;
}

.chunk-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.playing-indicator {
  color: var(--el-color-success);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.test-result {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.audio-player {
  width: 100%;
  height: 40px;
  outline: none;
}

.result-text {
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
}

.result-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-icon {
  font-size: 48px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.test-actions {
  margin-bottom: 12px;
}
</style>

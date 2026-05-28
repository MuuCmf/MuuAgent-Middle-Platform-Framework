<template>
  <el-drawer
    :model-value="visible"
    :title="testType === 'tts' ? $t('model.voiceTestTitle') : $t('model.asrTestTitle')"
    :size="500"
    @close="handleClose"
  >
    <template v-if="testType === 'tts'">
      <el-form label-width="80px" label-position="top">
        <el-form-item :label="$t('model.testInputText')">
          <el-input
            v-model="ttsText"
            type="textarea"
            :rows="4"
            :placeholder="$t('model.testInputPlaceholder')"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="$t('model.voiceType')">
              <el-select v-model="ttsVoice" style="width: 100%;" :loading="voicesLoading">
                <el-option
                  v-if="voiceOptions.length === 0 && !voicesLoading"
                  label="Alloy (中性)"
                  value="alloy"
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

      <div class="test-actions">
        <el-button type="primary" :loading="ttsLoading" @click="handleTTS" :disabled="!ttsText.trim()">
          {{ $t('model.testSynthesize') }}
        </el-button>
      </div>

      <div v-if="ttsResult" class="test-result">
        <div class="result-header">
          <span class="result-label">{{ $t('model.testPlayback') }}</span>
          <el-tag size="small">{{ ttsResult.format }}</el-tag>
        </div>
        <audio
          v-if="ttsAudioUrl"
          :src="ttsAudioUrl"
          controls
          class="audio-player"
        />
        <div v-if="ttsResult.duration" class="result-info">
          {{ $t('model.audioDuration') }}: {{ ttsResult.duration.toFixed(1) }}s
        </div>
      </div>
    </template>

    <template v-else>
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
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { request } from '@/utils/request'
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

/** TTS状态 */
const ttsText = ref('你好，欢迎使用语音合成测试。')
const ttsVoice = ref('alloy')
const ttsSpeed = ref(1.0)
const ttsLoading = ref(false)
const ttsResult = ref<{ format: string; duration?: number } | null>(null)
const ttsAudioUrl = ref<string>('')

/** 语音配置选项 */
const voiceOptions = ref<VoiceProfile[]>([])
const voicesLoading = ref(false)

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
 * 获取语音配置显示标签
 * @param voice 语音配置
 * @returns {string} 显示标签
 */
function voiceLabel(voice: VoiceProfile): string {
  const genderMap: Record<string, string> = {
    male: t('voice.male'),
    female: t('voice.female'),
    neutral: t('voice.neutral'),
  }
  const gender = voice.gender ? ` (${genderMap[voice.gender] || voice.gender})` : ''
  return `${voice.name}${gender} - ${voice.provider}`
}

/** 监听抽屉打开时加载语音配置 */
watch(() => props.visible, (val) => {
  if (val && props.testType === 'tts') {
    loadVoices()
  }
})

/** ASR状态 */
const asrAudioFile = ref<File | null>(null)
const asrFileList = ref<any[]>([])
const asrFormat = ref('wav')
const asrLoading = ref(false)
const asrResult = ref<{ text: string; confidence?: number; language?: string } | null>(null)

/**
 * TTS语音合成测试
 */
async function handleTTS() {
  if (!ttsText.value.trim()) return

  ttsLoading.value = true
  ttsResult.value = null
  ttsAudioUrl.value = ''

  try {
    const response = await request.post('/api/ai/tts', {
      text: ttsText.value,
      voice: ttsVoice.value,
      speed: ttsSpeed.value,
      modelCode: props.modelCode || undefined,
    })

    const data = response.data?.data

    if (data?.audioData) {
      const audioBlob = base64ToBlob(data.audioData, data.format || 'mp3')
      ttsAudioUrl.value = URL.createObjectURL(audioBlob)
    }

    ttsResult.value = {
      format: data?.format || 'mp3',
      duration: data?.duration,
    }

    ElMessage.success(t('model.testSuccess'))
  } catch (error: any) {
    console.error('TTS测试失败:', error)
    ElMessage.error(error.response?.data?.message || '语音合成失败')
  } finally {
    ttsLoading.value = false
  }
}

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
        const base64Data = result.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(asrAudioFile.value!)
    })

    const response = await request.post('/api/ai/asr', {
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
    console.error('ASR测试失败:', error)
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
  if (ttsAudioUrl.value) {
    URL.revokeObjectURL(ttsAudioUrl.value)
  }
  ttsResult.value = null
  ttsAudioUrl.value = ''
  asrResult.value = null
  asrAudioFile.value = null
  asrFileList.value = []
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.test-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.test-result {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
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
</style>

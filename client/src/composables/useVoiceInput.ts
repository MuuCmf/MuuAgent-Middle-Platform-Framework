import { ref, readonly } from 'vue'
import { useAudioRecorder } from './useAudioRecorder'
import { httpClient } from '../utils/request'

/**
 * 语音输入状态
 */
export type VoiceInputStatus = 'idle' | 'recording' | 'recognizing' | 'error'

/**
 * 语音输入结果
 */
export interface VoiceInputResult {
  /** 识别文本 */
  text: string
  /** 置信度（0-1，可选） */
  confidence?: number
  /** 检测到的语言（可选） */
  language?: string
}

/**
 * 语音输入 Composable
 *
 * 实现"按住说话→松开识别"的完整流程：
 * 1. mousedown → 开始录音
 * 2. mouseup → 停止录音，发送到后端 ASR
 * 3. 返回识别文本，自动插入聊天输入框或直接发送
 *
 * @param onResult 识别成功回调
 * @param onError 识别失败回调
 */
export function useVoiceInput(
  onResult?: (result: VoiceInputResult) => void,
  onError?: (error: string) => void,
) {
  /** 语音输入状态 */
  const status = ref<VoiceInputStatus>('idle')
  /** 错误信息 */
  const error = ref<string | null>(null)
  /** 录音器实例（每次开始录音时创建） */
  let recorder: ReturnType<typeof useAudioRecorder> | null = null

  /** 浏览器是否支持录音 */
  const isSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getUserMedia
    && typeof MediaRecorder !== 'undefined'

  /**
   * 开始录音（鼠标按下时调用）
   */
  async function startRecording(): Promise<void> {
    if (!isSupported) {
      const msg = '当前浏览器不支持录音功能'
      error.value = msg
      status.value = 'error'
      onError?.(msg)
      return
    }

    // 创建新的录音器实例
    recorder = useAudioRecorder({
      mimeType: 'audio/webm;codecs=opus',
      maxDuration: 60000, // 最长60秒
    })

    const success = await recorder.startRecording()
    if (success) {
      status.value = 'recording'
      error.value = null
    } else {
      const msg = recorder.error.value || '启动录音失败'
      error.value = msg
      status.value = 'error'
      onError?.(msg)
    }
  }

  /**
   * 停止录音并发送到后端 ASR（鼠标松开时调用）
   *
   * @returns 识别结果，失败返回 null
   */
  async function stopAndRecognize(): Promise<VoiceInputResult | null> {
    if (!recorder || status.value !== 'recording') return null

    status.value = 'recognizing'

    try {
      // 停止录音并获取音频数据
      const audioResult = await recorder.stopRecording()
      if (!audioResult) {
        const msg = '未获取到音频数据'
        error.value = msg
        status.value = 'error'
        onError?.(msg)
        return null
      }

      // 发送到后端 ASR 接口
      const response = await httpClient.getInstance().post(
        '/api/ai/voice-chat',
        {
          audio: audioResult.audioBase64,
          format: 'webm',
        },
        {
          timeout: 30000,
        },
      )

      const data = response.data
      if (data.code === 200 && data.data) {
        const result: VoiceInputResult = {
          text: data.data.text || '',
          confidence: data.data.confidence,
          language: data.data.language,
        }

        status.value = 'idle'
        error.value = null
        onResult?.(result)
        return result
      } else {
        const msg = data.message || '语音识别失败'
        error.value = msg
        status.value = 'error'
        onError?.(msg)
        return null
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || '语音识别失败'
      error.value = msg
      status.value = 'error'
      onError?.(msg)
      return null
    }
  }

  /**
   * 取消录音（不发送）
   */
  function cancelRecording(): void {
    if (recorder && status.value === 'recording') {
      recorder.cancelRecording()
    }
    status.value = 'idle'
    error.value = null
    recorder = null
  }

  return {
    /** 当前状态 */
    status: readonly(status),
    /** 错误信息 */
    error: readonly(error),
    /** 浏览器是否支持 */
    isSupported,
    /** 开始录音 */
    startRecording,
    /** 停止录音并识别 */
    stopAndRecognize,
    /** 取消录音 */
    cancelRecording,
  }
}
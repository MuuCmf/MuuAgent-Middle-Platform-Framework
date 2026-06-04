import { ref, onUnmounted } from 'vue'
import { s2sStreamService, type S2sStatus, type S2sChunkData } from '../services/S2sStreamService'
import { voiceService } from '../services/VoiceService'

/**
 * S2S 音频配置
 */
export interface S2sAudioConfig {
  /** 会话ID */
  conversationId?: string
  /** 语音标识 */
  voiceId?: string
  /** S2S 模型编码 */
  modelCode?: string
  /** 音频格式（默认 opus） */
  audioFormat?: 'opus' | 'pcm' | 'wav'
  /** 是否启用回音消除 */
  echoCancellation?: boolean
  /** 是否启用噪声抑制 */
  noiseSuppression?: boolean
  /** 是否启用自动增益控制 */
  autoGainControl?: boolean
}

/**
 * S2S 端到端语音对话 Composable
 *
 * 封装完整的 S2S 对话体验：
 * - 启动麦克风采集（MediaRecorder + Opus 编码）
 * - 实时将音频块通过 WS 发送到服务端
 * - 接收服务端返回的音频流并播放（复用 MSE 播放能力）
 * - 提供 start()、stop()、pause()、resume() 方法
 *
 * @param config S2S 配置
 */
export function useS2sAudio(config: S2sAudioConfig = {}) {
  /** 当前状态 */
  const status = ref<S2sStatus>('idle')

  /** 是否正在录音 */
  const isRecording = ref(false)

  /** 错误信息 */
  const error = ref<string | null>(null)

  /** 识别文本（实时更新） */
  const recognizedText = ref('')

  /** MediaRecorder 实例 */
  let mediaRecorder: MediaRecorder | null = null

  /** 麦克风媒体流 */
  let mediaStream: MediaStream | null = null

  /** 音频块发送定时器 */
  let sendTimer: number | null = null

  /** 音频块缓冲区 */
  let audioChunks: Blob[] = []

  /** 浏览器是否支持 */
  const isSupported = ref(false)

  /**
   * 检查浏览器支持
   */
  const checkSupport = (): boolean => {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
    const hasMediaDevices = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    const hasWebSocket = typeof WebSocket !== 'undefined'

    isSupported.value = hasMediaRecorder && hasMediaDevices && hasWebSocket
    return isSupported.value
  }

  /**
   * 启动 S2S 会话
   *
   * @param conversationId 会话ID（可选，默认使用配置中的值）
   */
  const startSession = async (conversationId?: string): Promise<void> => {
    if (!checkSupport()) {
      error.value = '浏览器不支持实时语音对话'
      console.error('[S2S] 浏览器不支持:', error.value)
      return
    }

    const convId = conversationId || config.conversationId
    if (!convId) {
      error.value = '缺少会话ID'
      console.error('[S2S] 缺少会话ID')
      return
    }

    console.log('[S2S] 启动会话:', convId)

    try {
      // 连接到 S2S WebSocket
      const voiceConfig = voiceService.getConfig()
      const voiceId = config.voiceId || voiceConfig.voiceId
      const modelCode = config.modelCode

      console.log('[S2S] 连接参数:', { voiceId, modelCode })

      const connected = s2sStreamService.connect(convId, voiceId, modelCode)
      if (!connected) {
        error.value = 'WebSocket 连接失败'
        console.error('[S2S] WebSocket 连接失败')
        return
      }

      console.log('[S2S] WebSocket 已连接')

      // 设置事件回调
      s2sStreamService.setCallbacks({
        onStart: () => {
          console.log('[S2S] 会话已开始')
          status.value = 'streaming'
          startRecording()
        },
        onChunk: (chunk: S2sChunkData) => {
          console.log('[S2S] 收到音频块:', chunk.sequence)
          // 音频块自动播放（由 S2sStreamService 处理）
        },
        onText: (text: string) => {
          console.log('[S2S] 识别文本:', text)
          recognizedText.value += text
        },
        onEnd: () => {
          console.log('[S2S] 会话已结束')
          status.value = 'stopped'
          stopRecording()
        },
        onError: (err: Error) => {
          console.error('[S2S] 错误:', err.message)
          error.value = err.message
          status.value = 'error'
          stopRecording()
        },
        onStatusChange: (newStatus: S2sStatus) => {
          console.log('[S2S] 状态变化:', newStatus)
          status.value = newStatus
        },
      })

      status.value = 'connecting'
      console.log('[S2S] 状态: connecting')
    } catch (err) {
      error.value = (err as Error).message
      console.error('[S2S] 启动失败:', error.value)
      status.value = 'error'
    }
  }

  /**
   * 启动麦克风录音
   */
  const startRecording = async (): Promise<void> => {
    try {
      // 获取麦克风权限
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: config.echoCancellation ?? true,
          noiseSuppression: config.noiseSuppression ?? true,
          autoGainControl: config.autoGainControl ?? true,
        },
      }

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      // 创建 MediaRecorder（优先使用 Opus 编码）
      const mimeType = getSupportedMimeType()
      mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      })

      // 监听音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
          sendAudioChunks()
        }
      }

      // 开始录音，每 100ms 触发一次 ondataavailable
      mediaRecorder.start(100)
      isRecording.value = true

      // 定时发送音频块（防止缓冲区过大）
      sendTimer = window.setInterval(() => {
        if (audioChunks.length > 0) {
          sendAudioChunks()
        }
      }, 200)
    } catch (err) {
      error.value = `麦克风启动失败: ${(err as Error).message}`
      stopRecording()
    }
  }

  /**
   * 停止麦克风录音
   */
  const stopRecording = (): void => {
    if (sendTimer) {
      clearInterval(sendTimer)
      sendTimer = null
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }

    // 发送剩余音频块
    if (audioChunks.length > 0) {
      sendAudioChunks(true)
    }

    audioChunks = []
    isRecording.value = false
  }

  /**
   * 发送音频块到服务端
   *
   * @param isLast 是否最后一块
   */
  const sendAudioChunks = async (isLast: boolean = false) => {
    if (audioChunks.length === 0) return

    try {
      // 合并音频块
      const blob = new Blob(audioChunks, { type: getSupportedMimeType() })
      audioChunks = []

      // 转换为 Base64
      const base64 = await blobToBase64(blob)

      // 发送到服务端
      const format = config.audioFormat || 'opus'
      s2sStreamService.sendAudioChunk(base64, format, isLast)
    } catch (err) {
      console.error('发送音频块失败:', err)
    }
  }

  /**
   * 停止 S2S 会话
   */
  const stopSession = (): void => {
    stopRecording()
    s2sStreamService.stop()
    status.value = 'idle'
    recognizedText.value = ''
  }

  /**
   * 暂停播放
   */
  const pause = (): void => {
    s2sStreamService.pause()
  }

  /**
   * 恢复播放
   */
  const resume = (): void => {
    s2sStreamService.resume()
  }

  /**
   * 切换语音
   *
   * @param voiceId 语音标识
   */
  const changeVoice = (voiceId: string): void => {
    s2sStreamService.changeVoice(voiceId)
  }

  /**
   * 切换模型
   *
   * @param modelCode 模型编码
   */
  const changeModel = (modelCode: string): void => {
    s2sStreamService.changeModel(modelCode)
  }

  /**
   * 获取支持的音频 MIME 类型
   */
  const getSupportedMimeType = (): string => {
    const formats = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        return format
      }
    }

    return 'audio/webm' // 默认格式
  }

  /**
   * Blob 转 Base64
   */
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // 移除 data:audio/webm;base64, 前缀
        const base64Data = base64.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 组件卸载时清理资源
   */
  onUnmounted(() => {
    stopSession()
  })

  // 初始化时检查浏览器支持
  checkSupport()

  return {
    /** 当前状态 */
    status,
    /** 是否正在录音 */
    isRecording,
    /** 浏览器是否支持 */
    isSupported,
    /** 错误信息 */
    error,
    /** 识别文本 */
    recognizedText,
    /** 启动会话 */
    startSession,
    /** 停止会话 */
    stopSession,
    /** 暂停播放 */
    pause,
    /** 恢复播放 */
    resume,
    /** 切换语音 */
    changeVoice,
    /** 切换模型 */
    changeModel,
  }
}
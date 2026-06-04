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
  /** 音频格式（仅供兼容，固定为 pcm） */
  audioFormat?: 'pcm'
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
 * - 启动麦克风采集（AudioContext + ScriptProcessorNode，直接输出 PCM 16000Hz int16）
 * - 实时将音频块通过 WS 发送到服务端
 * - 接收服务端返回的音频流并播放
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

  /** AudioContext 实例（PCM 采集） */
  let audioContext: AudioContext | null = null

  /** ScriptProcessorNode 实例 */
  let scriptNode: ScriptProcessorNode | null = null

  /** 麦克风媒体流 */
  let mediaStream: MediaStream | null = null

  /** 音频块发送定时器 */
  let sendTimer: number | null = null

  /** PCM 缓冲区（Int16Array 片段） */
  let pcmChunks: Int16Array[] = []

  /** PCM 缓冲区总字节数 */
  let pcmBufferSize = 0

  /** 目标采样率（火山引擎固定 16000Hz） */
  const TARGET_SAMPLE_RATE = 16000

  /** 浏览器是否支持 */
  const isSupported = ref(false)

  /**
   * 检查浏览器支持
   */
  const checkSupport = (): boolean => {
    const hasAudioContext = typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    const hasWebSocket = typeof WebSocket !== 'undefined'

    isSupported.value = hasAudioContext && hasMediaDevices && hasWebSocket
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

      const wasAlreadyConnected = s2sStreamService.isConnected
      console.log('[S2S] WebSocket 已连接, wasAlreadyConnected=', wasAlreadyConnected)

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

      // 如果 WS 已连接（连续对话复用），直接启动录音
      if (wasAlreadyConnected) {
        console.log('[S2S] WS 已连接，直接启动录音')
        status.value = 'streaming'
        startRecording()
      } else {
        status.value = 'connecting'
      }
      console.log('[S2S] 状态: connecting')
    } catch (err) {
      error.value = (err as Error).message
      console.error('[S2S] 启动失败:', error.value)
      status.value = 'error'
    }
  }

  /**
   * 启动麦克风录音（PCM 直接采集）
   *
   * 使用 AudioContext + ScriptProcessorNode 直接采集 PCM 16000Hz int16 数据，
   * 替代 MediaRecorder 编码（避免 Opus/WebM → PCM 转换问题）。
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

      // 使用 AudioContext 采集原始 PCM
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioCtx()

      // AudioContext 可能因浏览器策略处于 suspended 状态
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const source = audioContext.createMediaStreamSource(mediaStream)
      const inputSampleRate = audioContext.sampleRate // 通常 48000 或 44100
      const bufferSize = 4096

      // ScriptProcessorNode（已废弃但广泛兼容）
      scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1)

      scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0) // Float32[]

        // 下采样到 16000Hz：先低通滤波抗混叠，再线性抽取
        const downsampleRatio = inputSampleRate / TARGET_SAMPLE_RATE
        // 3 点移动平均抗混叠（简单 FIR 低通，截止 ~7kHz@48kHz）
        const filtered = new Float32Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          let sum = 0
          let count = 0
          for (let j = -1; j <= 1; j++) {
            const idx = i + j
            if (idx >= 0 && idx < inputData.length) {
              sum += inputData[idx]
              count++
            }
          }
          filtered[i] = sum / count
        }

        const outputLength = Math.floor(inputData.length / downsampleRatio)
        const pcmData = new Int16Array(outputLength)

        for (let i = 0; i < outputLength; i++) {
          const srcIndex = Math.floor(i * downsampleRatio)
          // Float32 [-1, 1] → Int16 [-32768, 32767]
          const sample = Math.max(-1, Math.min(1, filtered[srcIndex]))
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        }

        // 累积到缓冲区
        pcmChunks.push(pcmData)
        pcmBufferSize += pcmData.byteLength

        // 达到阈值立即发送（约 1 秒 PCM 16000Hz = 32000 字节）
        if (pcmBufferSize >= 32000) {
          flushPcmBuffer()
        }
      }

      // ScriptProcessorNode 必须连接 destination 才能触发 onaudioprocess
      // 但直连会播放麦克风声音到扬声器，导致反馈啸叫。
      // 在中间插入 GainNode 并将增益设为 0 来静音。
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      source.connect(scriptNode)
      scriptNode.connect(silentGain)
      silentGain.connect(audioContext.destination)

      isRecording.value = true

      // 定时刷新残留缓冲区
      sendTimer = window.setInterval(() => {
        if (pcmChunks.length > 0) {
          flushPcmBuffer()
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

    // 断开并清理 AudioContext
    if (scriptNode) {
      scriptNode.disconnect()
      scriptNode = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }

    // 发送剩余 PCM 数据（最后一块）
    if (pcmChunks.length > 0) {
      flushPcmBuffer(true)
    }

    pcmChunks = []
    pcmBufferSize = 0
    isRecording.value = false
  }

  /**
   * 刷新 PCM 缓冲区并发送到服务端
   *
   * @param isLast 是否最后一块
   */
  const flushPcmBuffer = (isLast: boolean = false) => {
    if (pcmChunks.length === 0) return

    try {
      // 计算总长度并合并所有 Int16Array
      let totalLength = 0
      for (const chunk of pcmChunks) {
        totalLength += chunk.length
      }

      const merged = new Int16Array(totalLength)
      let offset = 0
      for (const chunk of pcmChunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      pcmChunks = []
      pcmBufferSize = 0

      // Int16Array → base64
      const bytes = new Uint8Array(merged.buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      // 发送 PCM 数据到服务端
      s2sStreamService.sendAudioChunk(base64, 'pcm', isLast)
    } catch (err) {
      console.error('发送 PCM 数据失败:', err)
    }
  }

  /**
   * 停止录音（连续对话模式：保持 WS 连接，可再次说话）
   */
  const stopSession = (): void => {
    stopRecording()
    s2sStreamService.stop()
    status.value = 'idle'
  }

  /**
   * 结束整个对话（停止录音 + 断开 WS）
   */
  const endSession = (): void => {
    stopRecording()
    s2sStreamService.endConversation()
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
   * 组件卸载时清理资源
   */
  onUnmounted(() => {
    endSession()
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
    /** 停止录音（保持 WS 连接） */
    stopSession,
    /** 结束整个对话（断开 WS） */
    endSession,
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
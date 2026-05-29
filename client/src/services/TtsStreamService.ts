import { io, Socket } from 'socket.io-client'
import { voiceService } from './VoiceService'

/**
 * 音频块数据
 */
export interface AudioChunkData {
  /** Base64编码的音频数据 */
  data: string
  /** 音频格式：pcm / mp3 / wav / opus */
  format: string
  /** 块序号 */
  sequence: number
  /** 是否为最后一块 */
  isLast: boolean
}

/**
 * TTS 播放状态
 */
export type TtsPlaybackStatus = 'idle' | 'streaming' | 'playing' | 'paused' | 'stopped'

/**
 * TTS 事件回调
 */
export interface TtsEventCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onChunk?: (chunk: AudioChunkData) => void
  onError?: (error: Error) => void
  onStatusChange?: (status: TtsPlaybackStatus) => void
}

/**
 * 实时语音流服务
 *
 * 通过 Socket.io WebSocket 连接接收实时 TTS 音频流，
 * 使用 Web Audio API 进行 PCM 解码和播放。
 * 音频块按 sequence 顺序排队播放，支持暂停/恢复/停止控制。
 */
class TtsStreamService {
  private socket: Socket | null = null
  private audioContext: AudioContext | null = null
  private audioQueue: AudioChunkData[] = []
  private isProcessing = false
  private isPaused = false
  private currentStatus: TtsPlaybackStatus = 'idle'
  private callbacks: TtsEventCallbacks = {}
  private conversationId: string | null = null
  private gainNode: GainNode | null = null
  private currentSource: AudioBufferSourceNode | null = null

  /**
   * 获取当前播放状态
   */
  get status(): TtsPlaybackStatus {
    return this.currentStatus
  }

  /**
   * 获取当前会话ID
   */
  get currentConversationId(): string | null {
    return this.conversationId
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * 设置事件回调
   */
  setCallbacks(callbacks: TtsEventCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * 更新事件回调
   */
  updateCallbacks(callbacks: Partial<TtsEventCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * 连接到 TTS WebSocket 服务
   *
   * 根据文档，客户端连接 /tts 命名空间即表示启用了语音播报。
   * 语音参数（voiceId/speed）在连接时通过 query 传递。
   *
   * @param conversationId 会话ID（关联 SSE 文本流）
   * @param voiceId 语音标识（可选，默认使用 VoiceService 配置）
   * @param speed 语速（可选，默认使用 VoiceService 配置）
   * @returns 是否成功连接
   */
  connect(
    conversationId: string,
    voiceId?: string,
    speed?: number,
  ): boolean {
    if (this.socket?.connected) {
      if (this.conversationId === conversationId) {
        return true
      }
      this.disconnect()
    }

    this.conversationId = conversationId

    const config = voiceService.getConfig()
    const queryVoiceId = voiceId || config.voiceId || 'alloy'
    const querySpeed = speed ?? config.speed ?? 1.0

    // 使用同源连接，Vite开发服务器通过 /socket.io 代理转发到后端
    this.socket = io('/tts', {
      query: {
        conversationId,
        voiceId: queryVoiceId,
        speed: String(querySpeed),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    })

    this.socket.on('connect', () => {
      console.log(`[TtsStream] 已连接: conversationId=${conversationId}`)
    })

    this.socket.on('audio_chunk', (chunk: AudioChunkData) => {
      this.handleAudioChunk(chunk)
    })

    this.socket.on('tts_start', (data: { totalSentences?: number }) => {
      console.log(`[TtsStream] TTS 开始: ${JSON.stringify(data)}`)
      this.updateStatus('streaming')
      this.callbacks.onStart?.()
    })

    this.socket.on('tts_end', () => {
      console.log('[TtsStream] TTS 结束')
      this.callbacks.onEnd?.()
    })

    this.socket.on('error', (error: { message: string }) => {
      console.error('[TtsStream] 服务端错误:', error.message)
      this.callbacks.onError?.(new Error(error.message))
    })

    this.socket.on('disconnect', (reason) => {
      console.log(`[TtsStream] 连接断开: ${reason}`)
      this.cleanup()
    })

    this.socket.on('connect_error', (err) => {
      console.error('[TtsStream] 连接失败:', err.message)
      this.callbacks.onError?.(new Error(`TTS连接失败: ${err.message}`))
    })

    return true
  }

  /**
   * 断开 TTS WebSocket 连接
   */
  disconnect(): void {
    this.stopPlayback()
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.conversationId = null
    this.audioQueue = []
    this.isProcessing = false
    this.isPaused = false
    this.nextChunkTime = 0
    this.updateStatus('idle')
  }

  /**
   * 暂停语音播报
   */
  pause(): void {
    if (!this.socket?.connected) return
    this.isPaused = true
    this.socket.emit('pause')
    this.updateStatus('paused')
  }

  /**
   * 恢复语音播报
   */
  resume(): void {
    if (!this.socket?.connected) return
    this.isPaused = false
    this.socket.emit('resume')
    this.updateStatus('playing')
    this.processQueue()
  }

  /**
   * 停止语音播报并清空队列
   */
  stop(): void {
    if (!this.socket?.connected) return
    this.stopPlayback()
    this.socket.emit('stop')
    this.audioQueue = []
    this.isProcessing = false
    this.isPaused = false
    this.nextChunkTime = 0
    this.updateStatus('stopped')
  }

  /**
   * 切换语音
   *
   * @param voiceId 新的语音标识
   */
  changeVoice(voiceId: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('change_voice', { voiceId })
    voiceService.updateConfig({ voiceId })
  }

  /**
   * 调整语速
   *
   * @param speed 语速（0.5~2.0）
   */
  changeSpeed(speed: number): void {
    if (!this.socket?.connected) return
    this.socket.emit('change_speed', { speed })
    voiceService.updateConfig({ speed })
  }

  /**
   * 处理接收到的音频块
   *
   * @param chunk 音频块数据
   */
  private handleAudioChunk(chunk: AudioChunkData): void {
    this.callbacks.onChunk?.(chunk)

    if (!chunk.data) return

    this.audioQueue.push(chunk)

    if (!this.isProcessing && !this.isPaused) {
      this.processQueue()
    }
  }

  /**
   * 处理音频队列
   *
   * 按顺序逐个播放音频块，确保播放顺序正确。
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.audioQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.audioQueue.length > 0 && !this.isPaused) {
        const chunk = this.audioQueue.shift()!
        this.updateStatus('playing')
        await this.playAudioChunk(chunk)
      }
    } catch (error) {
      console.error('[TtsStream] 音频播放异常:', error)
      this.callbacks.onError?.(new Error(`音频播放异常: ${error}`))
    } finally {
      this.isProcessing = false

      if (!this.isPaused && this.audioQueue.length > 0) {
        this.processQueue()
      }

      if (this.audioQueue.length === 0 && !this.isPaused) {
        this.updateStatus('streaming')
      }
    }
  }

  /**
   * 播放单个音频块
   *
   * PCM 格式使用 Web Audio API 解码播放，
   * MP3 格式使用 HTMLAudioElement 播放。
   *
   * @param chunk 音频块数据
   */
  private async playAudioChunk(chunk: AudioChunkData): Promise<void> {
    if (chunk.format === 'mp3') {
      await this.playMp3Chunk(chunk)
    } else {
      await this.playPcmChunk(chunk)
    }
  }

  /** 下一个音频块的调度时间（用于无间隙连续播放） */
  private nextChunkTime = 0

  /**
   * 播放 PCM 音频块
   *
   * 参考管理端测试组件的实现方式：
   * - 不通过 decodeAudioData 解码（无法解码裸 PCM）
   * - 直接将 Int16 采样点转为 Float32，通过 createBuffer 构建 AudioBuffer
   * - 使用 nextChunkTime 实现无间隙连续播放
   *
   * @param chunk 音频块数据
   */
  private async playPcmChunk(chunk: AudioChunkData): Promise<void> {
    const ctx = this.getAudioContext()

    // base64 → Int16 采样点数组
    const binary = atob(chunk.data)
    const sampleCount = Math.floor(binary.length / 2)
    if (sampleCount === 0) return

    const pcmData = new Int16Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      pcmData[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    }

    // Int16 → Float32
    const floatData = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      floatData[i] = pcmData[i] / 32768
    }

    // 手动构建 AudioBuffer（16位单声道 24000Hz）
    const audioBuffer = ctx.createBuffer(1, sampleCount, 24000)
    audioBuffer.getChannelData(0).set(floatData)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    const gainNode = this.getGainNode(ctx)
    source.connect(gainNode)
    gainNode.connect(ctx.destination)

    this.currentSource = source

    // 无间隙调度：在上一个块结束时紧接着播放
    const now = ctx.currentTime
    const startTime = Math.max(this.nextChunkTime, now)
    source.start(startTime)
    this.nextChunkTime = startTime + audioBuffer.duration

    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.currentSource = null
        resolve()
      }
    })
  }

  /**
   * 播放 MP3 音频块
   *
   * @param chunk 音频块数据
   */
  private async playMp3Chunk(chunk: AudioChunkData): Promise<void> {
    const audioUrl = `data:audio/mp3;base64,${chunk.data}`
    const audio = new Audio(audioUrl)
    audio.volume = voiceService.getConfig().volume

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve()
      audio.onerror = (e) => reject(new Error(`MP3播放失败: ${e}`))
      audio.play().catch(reject)
    })
  }

  /**
   * 停止当前播放
   */
  private stopPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // 忽略已停止的异常
      }
      this.currentSource = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.gainNode = null
    }
  }

  /**
   * 获取或创建 AudioContext
   *
   * @returns AudioContext 实例
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext()
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }
    return this.audioContext
  }

  /**
   * 获取音量控制节点
   *
   * @param ctx AudioContext 实例
   * @returns GainNode 实例
   */
  private getGainNode(ctx: AudioContext): GainNode {
    if (!this.gainNode) {
      this.gainNode = ctx.createGain()
    }
    this.gainNode.gain.value = voiceService.getConfig().volume
    return this.gainNode
  }

  /**
   * 更新播放状态
   *
   * @param status 新状态
   */
  private updateStatus(status: TtsPlaybackStatus): void {
    this.currentStatus = status
    this.callbacks.onStatusChange?.(status)
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.audioQueue = []
    this.isProcessing = false
    this.isPaused = false
    this.nextChunkTime = 0
    this.currentSource = null
    this.updateStatus('idle')
  }
}

/**
 * TTS 流式服务实例
 */
export const ttsStreamService = new TtsStreamService()

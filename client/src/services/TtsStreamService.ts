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
  /** PCM 采样率（仅 format=pcm 时有效，默认 24000） */
  sampleRate?: number
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
  private currentSourceHtml: HTMLAudioElement | null = null

  private currentChunk: AudioChunkData | null = null
  private retryCount = 0
  private readonly MAX_RETRY_COUNT = 3
  private readonly MAX_QUEUE_SIZE = 500
  private ttsEndReceived = false
  private ttsEndResolve: (() => void) | null = null

  /** 是否已开始播放（用于预缓冲控制） */
  private hasStartedPlayback = false
  /** 预缓冲最小块数：累积足够音频再开始播放，避免边播边等导致卡顿 */
  private readonly MIN_BUFFER_COUNT = 5

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
   * 语音参数（voiceId/speed/modelCode）在连接时通过 query 传递。
   *
   * @param conversationId 会话ID（关联 SSE 文本流）
   * @param voiceId 语音标识（可选，默认使用 VoiceService 配置）
   * @param speed 语速（可选，默认使用 VoiceService 配置）
   * @param modelCode TTS模型编码（可选，默认使用 VoiceService 配置）
   * @returns 是否成功连接
   */
  connect(
    conversationId: string,
    voiceId?: string,
    speed?: number,
    modelCode?: string,
  ): boolean {
    if (this.socket?.connected) {
      if (this.conversationId === conversationId) {
        return true
      }
      this.disconnect()
    }

    this.conversationId = conversationId
    this.ttsEndReceived = false

    const config = voiceService.getConfig()
    const queryVoiceId = voiceId || config.voiceId || 'alloy'
    const querySpeed = speed ?? config.speed ?? 1.0
    const queryModelCode = modelCode || config.modelCode || ''

    // 使用同源连接，Vite开发服务器通过 /socket.io 代理转发到后端
    this.socket = io('/tts', {
      query: {
        conversationId,
        voiceId: queryVoiceId,
        speed: String(querySpeed),
        modelCode: queryModelCode,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    })

    this.socket.on('connect', () => {
      console.log(`[TtsStream] 已连接: conversationId=${conversationId}`)
      this.updateStatus('streaming')
    })

    this.socket.on('audio_chunk', (chunk: AudioChunkData) => {
      this.handleAudioChunk(chunk)
    })

    this.socket.on('tts_start', (data: { totalSentences?: number }) => {
      console.log(`[TtsStream] TTS 开始: ${JSON.stringify(data)}`)
      this.ttsEndReceived = false
      this.updateStatus('streaming')
      this.callbacks.onStart?.()
    })

    this.socket.on('tts_end', () => {
      console.log('[TtsStream] TTS 结束')
      this.ttsEndReceived = true
      this.callbacks.onEnd?.()
      if (this.ttsEndResolve) {
        this.ttsEndResolve()
        this.ttsEndResolve = null
      }
    })

    this.socket.on('tts_error', (error: { message: string }) => {
      console.error('[TtsStream] TTS 服务端错误:', error.message)
      this.callbacks.onError?.(new Error(error.message))
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
   * 等待 WebSocket 连接就绪
   *
   * connect() 是异步的（socket.io 握手需要时间），
   * 此方法返回一个 Promise，在 socket 连接成功或超时时 resolve。
   * 用于确保 TTS 连接在发起流式请求前已就绪。
   *
   * @param timeoutMs 超时毫秒，默认 5000
   * @returns 是否成功连接
   */
  async waitForConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.socket?.connected) return true
    if (!this.socket) return false

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.socket?.off('connect', onConnected)
        this.socket?.off('connect_error', onError)
        resolve(this.socket?.connected ?? false)
      }, timeoutMs)

      const onConnected = () => {
        clearTimeout(timeout)
        resolve(true)
      }

      const onError = () => {
        clearTimeout(timeout)
        resolve(false)
      }

      this.socket!.once('connect', onConnected)
      this.socket!.once('connect_error', onError)
    })
  }

  /**
   * 等待 TTS 流结束（tts_end 事件）并等待音频队列播放完毕
   *
   * 用于 SSE 流式对话结束时，确保所有音频块都已播放完毕后再断开连接。
   * 如果 TTS 未连接或已收到 tts_end，立即检查队列是否为空。
   *
   * @param timeoutMs 超时毫秒，默认 30000
   * @returns 是否正常完成（非超时）
   */
  async waitForTtsEnd(timeoutMs = 30000): Promise<boolean> {
    if (!this.socket?.connected && !this.ttsEndReceived) return true

    if (!this.ttsEndReceived) {
      const received = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.ttsEndResolve = null
          console.warn('[TtsStream] 等待 tts_end 超时')
          resolve(false)
        }, timeoutMs)

        const originalResolve = this.ttsEndResolve
        this.ttsEndResolve = () => {
          clearTimeout(timeout)
          originalResolve?.()
          resolve(true)
        }
      })
      if (!received) return false
    }

    const queueCheckInterval = 100
    const maxWait = timeoutMs
    let waited = 0
    while ((this.audioQueue.length > 0 || this.isProcessing) && waited < maxWait) {
      await new Promise((r) => setTimeout(r, queueCheckInterval))
      waited += queueCheckInterval
    }

    return waited < maxWait
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
    this.hasStartedPlayback = false
    this.nextChunkTime = 0
    this.ttsEndReceived = false
    this.ttsEndResolve = null
    this.updateStatus('idle')
  }

  /**
   * 暂停语音播报
   */
  pause(): void {
    if (!this.socket?.connected) return
    this.isPaused = true

    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
      }
      this.currentSource = null
    }
    if (this.currentSourceHtml) {
      try {
        this.currentSourceHtml.pause()
      } catch {
      }
      this.currentSourceHtml = null
    }

    this.currentChunk = null
    // 保留 nextChunkTime，用于恢复时保持时间轴连续性
    this.socket.emit('pause')
    this.updateStatus('paused')
  }

  /**
   * 恢复语音播报
   */
  resume(): void {
    if (!this.socket?.connected) return
    this.isPaused = false
    this.nextChunkTime = 0
    this.retryCount = 0
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
    this.hasStartedPlayback = false
    this.nextChunkTime = 0
    this.currentChunk = null
    this.retryCount = 0
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
   * 切换TTS模型
   *
   * @param modelCode 模型编码
   */
  changeModel(modelCode: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('change_model', { modelCode })
    voiceService.updateConfig({ modelCode })
  }

  /**
   * 处理接收到的音频块
   *
   * 预缓冲策略：首次播放前累积 MIN_BUFFER_COUNT 个音频块再开始，
   * 避免首个块立即播放后等待后续块到达导致的卡顿。
   *
   * @param chunk 音频块数据
   */
  private handleAudioChunk(chunk: AudioChunkData): void {
    this.callbacks.onChunk?.(chunk)

    if (!chunk.data) return

    console.log(`[TtsStream] 收到音频块: seq=${chunk.sequence}, format=${chunk.format}, size=${chunk.data.length}, isLast=${chunk.isLast}`)

    if (this.audioQueue.length >= this.MAX_QUEUE_SIZE) {
      console.warn(`[TtsStream] 音频队列已满(${this.MAX_QUEUE_SIZE})，丢弃旧块`)
      this.audioQueue.shift()
    }

    this.audioQueue.push(chunk)

    if (!this.isProcessing && !this.isPaused) {
      // 预缓冲：首次播放或队列排空后重新累积足够块数再开始
      // 如果已收到 tts_end 说明后续无更多块，立即开始无需等待
      if (!this.hasStartedPlayback && this.audioQueue.length < this.MIN_BUFFER_COUNT && !this.ttsEndReceived) {
        console.log(`[TtsStream] 预缓冲中: ${this.audioQueue.length}/${this.MIN_BUFFER_COUNT}`)
        return
      }
      this.processQueue()
    }
  }

  /**
   * 处理音频队列
   *
   * 按顺序逐个播放音频块，确保播放顺序正确。
   * 使用 peek 而非 shift 模式：暂停时当前块仍留在队列中，恢复后可重新播放。
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.audioQueue.length === 0) {
      return
    }

    console.log(`[TtsStream] 开始处理队列: 队列长度=${this.audioQueue.length}`)
    this.isProcessing = true
    this.hasStartedPlayback = true

    try {
      while (this.audioQueue.length > 0 && !this.isPaused) {
        this.currentChunk = this.audioQueue[0]
        this.updateStatus('playing')

        try {
          await this.playAudioChunk(this.currentChunk)
        } catch (error) {
          this.retryCount++
          if (this.retryCount <= this.MAX_RETRY_COUNT) {
            console.warn(`[TtsStream] 音频块播放失败，重试(${this.retryCount}/${this.MAX_RETRY_COUNT})`)
            continue
          }
          console.error(`[TtsStream] 音频块播放失败(${this.MAX_RETRY_COUNT}次)，跳过:`, error)
          this.callbacks.onError?.(new Error(`音频播放异常: ${error}`))
          this.retryCount = 0
        }

        this.audioQueue.shift()
        this.currentChunk = null
        this.retryCount = 0
      }
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
   * 解码 PCM 数据（同步执行，移除 setTimeout 避免不必要的延迟）
   *
   * @param base64Data Base64 编码的 PCM 数据
   * @returns Float32Array 音频数据和采样数
   */
  private decodePcm(base64Data: string): { floatData: Float32Array; sampleCount: number } {
    const binary = atob(base64Data)
    const sampleCount = Math.floor(binary.length / 2)
    if (sampleCount === 0) {
      return { floatData: new Float32Array(0), sampleCount: 0 }
    }

    const pcmData = new Int16Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      pcmData[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    }

    const floatData = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      floatData[i] = pcmData[i] / 32768
    }

    return { floatData, sampleCount }
  }

  /**
   * 播放 PCM 音频块
   *
   * 使用 nextChunkTime 实现无间隙连续播放。
   * 首次播放前确保 AudioContext 已就绪（resume），避免首个块被调度到未激活的上下文中。
   *
   * @param chunk 音频块数据
   */
  private async playPcmChunk(chunk: AudioChunkData): Promise<void> {
    const ctx = await this.ensureAudioContext()
    const sampleRate = chunk.sampleRate || 24000

    const { floatData, sampleCount } = this.decodePcm(chunk.data)

    if (sampleCount === 0) {
      console.warn('[TtsStream] PCM 块数据为空')
      return
    }

    // 手动构建 AudioBuffer（16位单声道）
    const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate)
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

    console.log(`[TtsStream] 播放 PCM: samples=${sampleCount}, sampleRate=${sampleRate}, duration=${audioBuffer.duration.toFixed(2)}s, startTime=${startTime.toFixed(2)}`)

    // 超时兜底：如果 onended 不触发，超时后强制 resolve，防止队列卡死
    const timeoutMs = Math.max(5000, audioBuffer.duration * 1000 + 3000)
    let settled = false

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        if (this.currentSource === source) {
          this.currentSource = null
        }
        console.warn(`[TtsStream] PCM 块播放超时(${timeoutMs}ms): seq=${chunk.sequence}`)
        resolve()
      }, timeoutMs)

      source.onended = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (this.currentSource === source) {
          this.currentSource = null
        }
        console.log(`[TtsStream] PCM 块播放完成: seq=${chunk.sequence}`)
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
    this.currentSourceHtml = audio

    // 超时兜底：防止播放事件不触发导致队列卡死
    const timeoutMs = 30000
    let settled = false

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        if (this.currentSourceHtml === audio) {
          this.currentSourceHtml = null
        }
        console.warn(`[TtsStream] MP3 块播放超时(${timeoutMs}ms): seq=${chunk.sequence}`)
        resolve()
      }, timeoutMs)

      audio.onended = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (this.currentSourceHtml === audio) {
          this.currentSourceHtml = null
        }
        resolve()
      }
      audio.onerror = (e) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.currentSourceHtml = null
        reject(new Error(`MP3播放失败: ${e}`))
      }
      audio.play().catch((e) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.currentSourceHtml = null
        reject(e)
      })
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
      }
      this.currentSource = null
    }

    if (this.currentSourceHtml) {
      try {
        this.currentSourceHtml.pause()
        this.currentSourceHtml.src = ''
      } catch {
      }
      this.currentSourceHtml = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.gainNode = null
    }

    this.currentChunk = null
  }

  /**
   * 获取或创建 AudioContext
   *
   * @returns AudioContext 实例
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new AudioContext()
        console.log(`[TtsStream] 创建 AudioContext, state=${this.audioContext.state}`)
      } catch (e) {
        console.error('[TtsStream] 创建 AudioContext 失败:', e)
        throw new Error(`浏览器不支持 AudioContext 或音频被安全策略阻止: ${e}`)
      }
    }
    return this.audioContext
  }

  /**
   * 获取 AudioContext 并确保其已就绪（resume）
   *
   * 浏览器安全策略要求 AudioContext 在用户交互后才能激活。
   * 如果上下文为 suspended 状态，await resume 完成后再调度音频，
   * 避免音频块被调度到未激活的上下文中导致丢失或延迟。
   *
   * @returns 就绪的 AudioContext 实例
   */
  private async ensureAudioContext(): Promise<AudioContext> {
    const ctx = this.getAudioContext()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
        console.log('[TtsStream] AudioContext resume 成功')
      } catch (e) {
        console.warn('[TtsStream] AudioContext resume 失败:', e)
      }
    }
    return ctx
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
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
      }
      this.currentSource = null
    }

    if (this.currentSourceHtml) {
      try {
        this.currentSourceHtml.pause()
        this.currentSourceHtml.src = ''
      } catch {
      }
      this.currentSourceHtml = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.gainNode = null
    }

    this.audioQueue = []
    this.isProcessing = false
    this.isPaused = false
    this.hasStartedPlayback = false
    this.nextChunkTime = 0
    this.currentChunk = null
    this.retryCount = 0
    this.ttsEndReceived = false
    this.ttsEndResolve = null
    this.updateStatus('idle')
  }
}

/**
 * TTS 流式服务实例
 */
export const ttsStreamService = new TtsStreamService()

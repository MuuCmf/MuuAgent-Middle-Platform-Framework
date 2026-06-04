import { io, Socket } from 'socket.io-client'
import { voiceService } from './VoiceService'

/**
 * S2S 音频块数据
 */
export interface S2sChunkData {
  /** Base64编码的音频数据 */
  data: string
  /** 音频格式：pcm / mp3 / wav / opus */
  format: string
  /** 块序号 */
  sequence: number
  /** 是否为最后一块 */
  isLast: boolean
  /** 附带识别文本（可选） */
  text?: string
}

/**
 * S2S 状态
 */
export type S2sStatus = 'idle' | 'connecting' | 'connected' | 'streaming' | 'stopped' | 'error'

/**
 * S2S 事件回调
 */
export interface S2sEventCallbacks {
  /** 会话开始 */
  onStart?: () => void
  /** 接收音频块 */
  onChunk?: (chunk: S2sChunkData) => void
  /** 接收识别文本 */
  /** 文本回调（含角色区分） */
  onText?: (text: string, role: 'user' | 'assistant') => void
  /** 会话结束 */
  onEnd?: () => void
  /** 错误 */
  onError?: (error: Error) => void
  /** 状态变化 */
  onStatusChange?: (status: S2sStatus) => void
}

/**
 * S2S 实时语音流服务
 *
 * 通过 Socket.io WebSocket 实现端到端语音对话：
 * - 连接到服务端 /s2s 命名空间
 * - 发送客户端音频块（麦克风采集）
 * - 接收服务端返回的音频流并播放
 * - 支持暂停/恢复/停止控制
 */
class S2sStreamService {
  private socket: Socket | null = null
  private audioContext: AudioContext | null = null
  private audioQueue: S2sChunkData[] = []
  private isProcessing = false
  private isPaused = false
  private currentStatus: S2sStatus = 'idle'
  private callbacks: S2sEventCallbacks = {}
  private conversationId: string | null = null
  private gainNode: GainNode | null = null
  private currentSource: AudioBufferSourceNode | null = null

  /** 音频发送序号 */
  private sendSeq = 0
  /** MSE 流式 MP3 播放 */
  private mseMediaSource: MediaSource | null = null
  private mseSourceBuffer: SourceBuffer | null = null
  private mseAudio: HTMLAudioElement | null = null
  private msePendingQueue: Uint8Array[] = []
  private mseInitialized = false

  /**
   * 获取当前状态
   */
  get status(): S2sStatus {
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
  setCallbacks(callbacks: S2sEventCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * 更新事件回调
   */
  updateCallbacks(callbacks: Partial<S2sEventCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * 连接到 S2S WebSocket 服务
   *
   * @param conversationId 会话ID
   * @param voiceId 语音标识（可选）
   * @param modelCode S2S模型编码（可选）
   * @param agentId 智能体ID（可选，传入后服务端会使用智能体名称和提示词）
   * @returns 是否成功连接
   */
  connect(
    conversationId: string,
    voiceId?: string,
    modelCode?: string,
    agentId?: string,
  ): boolean {
    if (this.socket?.connected) {
      if (this.conversationId === conversationId) {
        return true
      }
      this.disconnect()
    }

    this.conversationId = conversationId
    this.sendSeq = 0

    const config = voiceService.getConfig()
    const queryVoiceId = voiceId || config.voiceId || 'zh_female_vv_jupiter_bigtts'

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000'
    this.socket = io(`${wsUrl}/s2s`, {
      query: {
        conversationId,
        voiceId: queryVoiceId,
        modelCode: modelCode || undefined,
        agentId: agentId || undefined,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    this.setupSocketEvents()
    this.updateStatus('connecting')

    return true
  }

  /**
   * 设置 Socket 事件监听
   */
  private setupSocketEvents(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[S2sStreamService] WebSocket 已连接')
      this.updateStatus('connected')
      // 注意：不在此处触发 onStart，等 s2s_start 事件表示服务端会话真正就绪后再触发
    })

    this.socket.on('connect_error', (error: Error) => {
      console.error('[S2sStreamService] 连接错误:', error.message)
      this.handleError(new Error(`WebSocket 连接失败: ${error.message}`))
    })

    this.socket.on('connect_timeout', () => {
      console.error('[S2sStreamService] 连接超时')
      this.handleError(new Error('WebSocket 连接超时'))
    })

    this.socket.on('s2s_start', () => {
      console.log('[S2sStreamService] S2S 会话已开始')
      this.updateStatus('streaming')
      this.initMsePlayback()
      // 服务端会话已就绪，通知上层开始录音
      this.callbacks.onStart?.()
    })

    this.socket.on('audio_chunk', (data: S2sChunkData) => {
      console.log('[S2sStreamService] 收到音频块:', data.sequence)
      this.handleAudioChunk(data)
    })

    this.socket.on('speech_text', (data: { text: string; role: 'user' | 'assistant' }) => {
      console.log('[S2sStreamService] 识别文本:', data.text, '角色:', data.role)
      this.callbacks.onText?.(data.text, data.role || 'user')
    })

    this.socket.on('s2s_end', () => {
      console.log('[S2sStreamService] S2S 会话已结束')
      this.handleSessionEnd()
    })

    this.socket.on('s2s_error', (data: { message: string }) => {
      console.error('[S2sStreamService] S2S 错误:', data.message)
      this.handleError(new Error(data.message))
    })

    this.socket.on('disconnect', (reason: string) => {
      console.log('[S2sStreamService] WebSocket 断开:', reason)
      this.updateStatus('stopped')
    })

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[S2sStreamService] WebSocket 重连成功:', attemptNumber)
    })

    this.socket.on('reconnect_error', (error: Error) => {
      console.error('[S2sStreamService] 重连错误:', error.message)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('[S2sStreamService] 重连失败')
      this.handleError(new Error('WebSocket 重连失败'))
    })
  }

  /**
   * 发送音频块到服务端
   *
   * @param audioData Base64 音频数据
   * @param format 音频格式
   * @param isLast 是否最后一块
   */
  sendAudioChunk(audioData: string, format: string = 'pcm', isLast: boolean = false): void {
    if (!this.socket?.connected) {
      console.warn('S2S WebSocket 未连接')
      return
    }

    this.socket.emit('audio_chunk', {
      data: audioData,
      format,
      sequence: this.sendSeq++,
      isLast,
    })
  }

  /**
   * 切换语音
   *
   * @param voiceId 语音标识
   */
  changeVoice(voiceId: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('change_voice', { voiceId })
  }

  /**
   * 切换模型
   *
   * @param modelCode 模型编码
   */
  changeModel(modelCode: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('change_model', { modelCode })
  }

  /**
   * 停止录音（连续对话模式：保持 WS 连接，只告知服务端停止输入）
   */
  stop(): void {
    if (!this.socket?.connected) return
    this.socket.emit('stop')
    // 连续对话：不断开 WS，保持连接供下次对话复用
  }

  /**
   * 结束整个对话（停止录音 + 断开 WS）
   */
  endConversation(): void {
    this.stop()
    this.disconnect()
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.isPaused = true
    if (this.mseAudio) {
      this.mseAudio.pause()
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    this.isPaused = false
    if (this.mseAudio) {
      this.mseAudio.play()
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.cleanupMse()
    this.audioQueue = []
    this.isProcessing = false
    this.isPaused = false
    this.updateStatus('idle')
    this.conversationId = null
    this.sendSeq = 0
  }

  /**
   * 初始化 MSE 流式播放
   */
  private initMsePlayback(): void {
    if (this.mseInitialized) return

    try {
      this.mseMediaSource = new MediaSource()
      this.mseAudio = document.createElement('audio')
      this.mseAudio.src = URL.createObjectURL(this.mseMediaSource)

      this.mseMediaSource.addEventListener('sourceopen', () => {
        try {
          this.mseSourceBuffer = this.mseMediaSource!.addSourceBuffer('audio/mpeg')
          this.mseSourceBuffer.addEventListener('updateend', () => {
            this.flushMseQueue()
          })
          this.mseInitialized = true
        } catch (err) {
          console.error('MSE SourceBuffer 创建失败:', err)
        }
      })

      // 播放/结束事件监听已移除（未使用）

      // 自动播放
      this.mseAudio.play().catch(err => {
        console.warn('MSE 自动播放失败:', err)
      })
    } catch (err) {
      console.error('MSE 初始化失败:', err)
    }
  }

  /**
   * 处理接收到的音频块
   *
   * @param data 音频块数据
   */
  private handleAudioChunk(data: S2sChunkData): void {
    this.callbacks.onChunk?.(data)

    // 跳过空音频块（来自 TTS_ENDED 的结束标记）
    if (!data.data || data.data.length === 0) {
      if (data.isLast) {
        // 连续对话模式：TTS 播完不代表会话结束，用户可继续说话
        console.log('[S2sStreamService] TTS 音频流结束，等待下一轮对话')
      }
      return
    }

    // 使用 MSE 流式播放 MP3
    if (data.format === 'mp3' && this.mseInitialized) {
      this.appendMseChunk(data.data)
    } else {
      // 非 MP3 格式，加入队列等待处理
      this.audioQueue.push(data)
      if (!this.isProcessing) {
        this.processAudioQueue()
      }
    }
  }

  /**
   * 添加 MP3 分片到 MSE SourceBuffer
   *
   * @param base64Data Base64 MP3 数据
   */
  private appendMseChunk(base64Data: string): void {
    if (!this.mseSourceBuffer) return

    try {
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      if (this.mseSourceBuffer.updating) {
        this.msePendingQueue.push(bytes)
      } else {
        this.mseSourceBuffer.appendBuffer(bytes)
      }
    } catch (err) {
      console.error('MSE appendBuffer 失败:', err)
    }
  }

  /**
   * 刷新 MSE 待处理队列
   */
  private flushMseQueue(): void {
    if (!this.mseSourceBuffer || this.mseSourceBuffer.updating) return

    while (this.msePendingQueue.length > 0) {
      const chunk = this.msePendingQueue.shift()
      if (!chunk) break

      try {
        this.mseSourceBuffer.appendBuffer(chunk as BufferSource)
        break // 每次只添加一个，等待 updateend
      } catch (err) {
        console.error('MSE flushQueue 失败:', err)
      }
    }
  }

  /**
   * 处理音频队列（非 MP3 格式）
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return
    this.isProcessing = true

    while (this.audioQueue.length > 0 && !this.isPaused) {
      const chunk = this.audioQueue.shift()
      if (!chunk) break

      await this.playAudioChunk(chunk)
    }

    this.isProcessing = false
  }

  /**
   * 播放单个音频块（PCM/WAV/Opus）
   *
   * @param chunk 音频块
   */
  private async playAudioChunk(chunk: S2sChunkData): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
      // AudioContext 可能被浏览器 suspend，需要用户交互唤醒
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    }

    try {
      const binary = atob(chunk.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      if (chunk.format === 'pcm') {
        // 裸 PCM 数据：无容器头，decodeAudioData 无法解码
        // 使用 createBuffer 手动构造 AudioBuffer
        await this.playRawPCM(bytes)
      } else {
        // 有容器格式（WAV/MP3/OGG）：使用 decodeAudioData
        const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer)
        this.currentSource = this.audioContext.createBufferSource()
        this.currentSource.buffer = audioBuffer
        this.currentSource.connect(this.gainNode!)
        await new Promise<void>((resolve) => {
          this.currentSource!.onended = () => resolve()
          this.currentSource!.start()
        })
      }
    } catch (err) {
      console.error('音频解码失败:', err)
    }
  }

  /**
   * 播放裸 PCM 数据（s16le）
   *
   * 火山引擎 S2S 返回的 PCM 格式为：pcm_s16le, 24000Hz, 单声道
   * 将 int16 样本转换为 float32 后封装为 AudioBuffer 播放
   *
   * @param bytes PCM int16 小端序原始字节
   */
  private async playRawPCM(bytes: Uint8Array): Promise<void> {
    // PCM16 (s16le) → Float32
    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768
    }

    const sampleRate = 24000 // 火山引擎 S2S 固定 24000Hz
    const audioBuffer = this.audioContext!.createBuffer(1, float32.length, sampleRate)
    audioBuffer.getChannelData(0).set(float32)

    this.currentSource = this.audioContext!.createBufferSource()
    this.currentSource.buffer = audioBuffer
    this.currentSource.connect(this.gainNode!)

    await new Promise<void>((resolve) => {
      this.currentSource!.onended = () => resolve()
      this.currentSource!.start()
    })
  }

  /**
   * 处理会话结束
   */
  private handleSessionEnd(): void {
    this.callbacks.onEnd?.()
    this.updateStatus('stopped')
    this.disconnect()
  }

  /**
   * 处理错误
   *
   * @param error 错误对象
   */
  private handleError(error: Error): void {
    this.callbacks.onError?.(error)
    this.updateStatus('error')
  }

  /**
   * 清理 MSE 资源
   */
  private cleanupMse(): void {
    if (this.mseAudio) {
      this.mseAudio.pause()
      this.mseAudio.src = ''
      this.mseAudio = null
    }

    if (this.mseMediaSource) {
      try {
        if (this.mseMediaSource.readyState === 'open') {
          this.mseMediaSource.endOfStream()
        }
      } catch { /* ignore */ }
      this.mseMediaSource = null
    }

    this.mseSourceBuffer = null
    this.msePendingQueue = []
    this.mseInitialized = false
  }

  /**
   * 更新状态
   *
   * @param status 新状态
   */
  private updateStatus(status: S2sStatus): void {
    this.currentStatus = status
    this.callbacks.onStatusChange?.(status)
  }
}

/** S2S 流式服务单例 */
export const s2sStreamService = new S2sStreamService()
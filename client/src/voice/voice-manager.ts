import { AsrClient } from './asr-client'
import { TtsClient } from './tts-client'

/** 语音管理器状态 */
type VoiceManagerState = 'idle' | 'recording' | 'speaking'

/**
 * 语音管理器（渲染进程侧）
 * 在浏览器环境中运行，统筹麦克风采集、ASR 识别、TTS 播放
 */
export class VoiceManager {
  /** ASR 客户端实例 */
  private asrClient: AsrClient | null = null
  /** TTS 客户端实例 */
  private ttsClient: TtsClient | null = null
  /** 当前状态 */
  private state: VoiceManagerState = 'idle'
  /** 录音流 */
  private mediaStream: MediaStream | null = null
  /** 音频上下文 */
  private audioContext: AudioContext | null = null
  /** 音频处理器节点 */
  private processor: ScriptProcessorNode | null = null

  constructor() {
    this.ttsClient = new TtsClient()
  }

  /**
   * 获取当前状态
   * @returns {VoiceManagerState} 当前状态
   */
  getState(): VoiceManagerState {
    return this.state
  }

  /**
   * 开始录音并实时识别
   * @param asrUrl 后端 ASR WebSocket 地址
   * @param onResult 实时识别结果回调
   */
  async startRecording(asrUrl: string, onResult: (text: string, isFinal: boolean) => void): Promise<void> {
    if (this.state === 'recording') return

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.asrClient = new AsrClient()
    this.asrClient.connect(asrUrl, onResult)

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const pcmData = this.float32ToInt16(inputData)
      this.asrClient?.sendAudio(pcmData.buffer as ArrayBuffer)
    }

    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    this.state = 'recording'
  }

  /** 停止录音 */
  stopRecording(): void {
    this.asrClient?.disconnect()
    this.asrClient = null

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    this.audioContext?.close()
    this.audioContext = null

    this.state = 'idle'
  }

  /**
   * 播放 TTS 合成音频
   * @param audioData 音频数据
   */
  async playTts(audioData: ArrayBuffer): Promise<void> {
    this.state = 'speaking'
    try {
      const context = new AudioContext()
      const audioBuffer = await context.decodeAudioData(audioData)
      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.connect(context.destination)

      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
        source.start(0)
      })
    } finally {
      this.state = 'idle'
    }
  }

  /**
   * 通过 TTS 合成并播放文本
   * @param text 要合成的文本
   * @param ttsUrl 后端 TTS 接口地址
   */
  async speak(text: string, ttsUrl: string): Promise<void> {
    if (!this.ttsClient) {
      this.ttsClient = new TtsClient()
    }
    const audioData = await this.ttsClient.synthesize(text, ttsUrl)
    await this.playTts(audioData)
  }

  /** Float32 转 Int16 PCM */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }
}

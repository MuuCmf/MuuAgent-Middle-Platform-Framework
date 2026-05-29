import { httpClient } from '../utils/request';

/**
 * TTS合成参数接口
 */
export interface TTSParams {
  text: string;
  voice?: string;
  speed?: number;
  modelCode?: string;
}

/**
 * TTS合成结果接口
 */
export interface TTSResult {
  audioUrl?: string;
  audioData?: string;
  format: string;
  duration?: number;
}

/**
 * 语音配置接口
 */
export interface VoiceConfig {
  autoPlay: boolean;
  voiceId: string;
  speed: number;
  volume: number;
  modelCode?: string;
}

/**
 * 语音配置详情接口（从API加载）
 */
export interface VoiceProfileItem {
  id: number;
  name: string;
  code: string;
  voiceId: string;
  provider: string;
  modelCode?: string;
  language: string;
  gender?: string;
  isDefault: boolean;
}

/** localStorage 存储键名 */
const STORAGE_KEY = 'voice_config';

/**
 * 语音服务类
 * 提供TTS语音合成和音频播放功能
 */
class VoiceService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private config: VoiceConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 从 localStorage 加载配置
   * @returns {VoiceConfig} 持久化的配置或默认配置
   */
  private loadConfig(): VoiceConfig {
    const defaults: VoiceConfig = {
      autoPlay: false,
      voiceId: 'alloy',
      speed: 1.0,
      volume: 1.0,
      modelCode: '',
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      }
    } catch {
      // 忽略解析错误，使用默认值
    }
    return defaults;
  }

  /**
   * 持久化当前配置到 localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 初始化音频上下文
   * @returns {AudioContext} 音频上下文实例
   */
  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * TTS语音合成
   * @param params 合成参数
   * @returns {Promise<TTSResult>} 合成结果
   */
  async synthesize(params: TTSParams): Promise<TTSResult> {
    const response = await httpClient.getInstance().post('/api/ai/tts', {
      text: params.text,
      voice: params.voice || this.config.voiceId,
      speed: params.speed || this.config.speed,
      modelCode: params.modelCode,
    });
    return response.data.data;
  }

  /**
   * 播放音频（Base64数据）
   * @param audioData Base64编码的音频数据
   * @param _format 音频格式（未使用）
   */
  async playFromBase64(audioData: string, _format: string = 'mp3'): Promise<void> {
    const audioContext = this.initAudioContext();
    
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  }

  /**
   * 播放音频（URL）
   * @param audioUrl 音频URL
   */
  async playFromUrl(audioUrl: string): Promise<void> {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }

    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.volume = this.config.volume;
    await this.currentAudio.play();
  }

  /**
   * 停止播放
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * 检查是否正在播放
   * @returns {boolean} 是否正在播放
   */
  isPlaying(): boolean {
    return this.currentAudio !== null || this.audioContext !== null;
  }

  /**
   * 更新配置
   * @param config 新配置
   */
  updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();

    if (this.currentAudio && config.volume !== undefined) {
      this.currentAudio.volume = config.volume;
    }
  }

  /**
   * 获取当前配置
   * @returns {VoiceConfig} 当前配置
   */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * 获取可用语音列表
   * 仅从API加载语音配置
   * 加载成功后，若当前voiceId为硬编码默认值，自动切换到接口返回的默认语音
   * @returns {Promise<VoiceProfileItem[]>} 语音配置列表
   */
  async getAvailableVoices(): Promise<VoiceProfileItem[]> {
    try {
      const response = await httpClient.getInstance().get('/api/voice-profile/list');
      const data = response.data?.data;
      if (data?.list && data.list.length > 0) {
        const voices = data.list.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          voiceId: item.voiceId,
          provider: item.provider,
          modelCode: item.modelCode,
          language: item.language,
          gender: item.gender,
          isDefault: item.isDefault,
        }));

        const defaultVoice = voices.find((v: VoiceProfileItem) => v.isDefault);
        if (defaultVoice && this.config.voiceId === 'alloy') {
          this.config.voiceId = defaultVoice.voiceId;
          this.saveConfig();
        }

        return voices;
      }
      return [];
    } catch {
      return [];
    }
  }
}

/**
 * 语音服务实例
 */
export const voiceService = new VoiceService();
import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';
import {
  TTSExecutionParams,
  TTSExecutionResult,
  TTSStreamChunk,
  ASRExecutionParams,
  ASRExecutionResult,
} from './provider.strategy.interface';
import OpenAI from 'openai';

/**
 * OpenAI 策略
 * OpenAI 官方 API 的调用策略
 */
@Injectable()
export class OpenAIStrategy extends BaseStrategy {
  readonly name = 'OpenAI';
  readonly providerId = 'openai';

  /**
   * 清理并标准化 baseURL
   * 兼容处理火山引擎等可能误配置的情况
   * @param baseURL 原始 baseURL
   * @returns 标准化后的 baseURL
   */
  private normalizeBaseURL(baseURL?: string | null): string {
    if (!baseURL) return 'https://api.openai.com/v1';
    let url = baseURL.trim();
    // 移除末尾的 /responses（常见火山引擎误配置）
    url = url.replace(/\/responses\/?$/, '');
    // 移除末尾的 /（防止双斜杠）
    url = url.replace(/\/+$/, '');
    return url;
  }

  /**
   * TTS语音合成
   * @param params TTS参数
   * @returns {Promise<TTSExecutionResult>} 音频结果
   */
  async executeTTS(params: TTSExecutionParams): Promise<TTSExecutionResult> {
    const { model, text, voice, speed } = params;

    this.logger.debug(`TTS语音合成: model=${model.code}, voice=${voice || 'alloy'}, speed=${speed || 1.0}`);

    const openai = new OpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.normalizeBaseURL(model.endpoint),
    });
    
    const response = await openai.audio.speech.create({
      model: model.code || 'tts-1',
      input: text,
      voice: voice || 'alloy',
      speed: speed || 1.0,
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioData = audioBuffer.toString('base64');

    return {
      audioData,
      format: 'mp3',
    };
  }

  /**
   * 流式TTS合成
   *
   * 使用 OpenAI TTS-1 模型的 PCM 格式流式输出。
   * 通过读取 HTTP response body 逐块 yield 音频数据。
   *
   * @param params TTS执行参数
   * @returns 音频块异步迭代器
   */
  async *executeTTSStream(
    params: TTSExecutionParams,
  ): AsyncIterable<TTSStreamChunk> {
    const { model, text, voice, speed } = params;

    this.logger.debug(
      `OpenAI流式TTS: model=${model.code}, voice=${voice || 'alloy'}`,
    );

    const openai = new OpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.normalizeBaseURL(model.endpoint),
    });

    const response = await openai.audio.speech.create({
      model: model.code || 'tts-1',
      input: text,
      voice: (voice as any) || 'alloy',
      speed: speed || 1.0,
      response_format: 'pcm',
    });

    const stream = response.body as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    let sequence = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          yield {
            audioData: '',
            format: 'pcm',
            sequence,
            isLast: true,
            sampleRate: 24000,
          };
          break;
        }

        yield {
          audioData: Buffer.from(value).toString('base64'),
          format: 'pcm',
          sequence: sequence++,
          isLast: false,
          sampleRate: 24000,
        };
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * ASR语音识别
   * @param params ASR参数
   * @returns {Promise<ASRExecutionResult>} 识别结果
   */
  async executeASR(params: ASRExecutionParams): Promise<ASRExecutionResult> {
    const { model, audio, format } = params;

    this.logger.debug(`ASR语音识别: model=${model.code}, format=${format || 'wav'}`);

    const openai = new OpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.normalizeBaseURL(model.endpoint),
    });
    
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioFile = new File([audioBuffer], `audio.${format || 'wav'}`, {
      type: `audio/${format || 'wav'}`,
    });

    const response = await openai.audio.transcriptions.create({
      model: model.code || 'whisper-1',
      file: audioFile,
      language: 'zh',
    });

    return {
      text: response.text,
      language: 'zh',
    };
  }
}

import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';
import {
  TTSExecutionParams,
  TTSExecutionResult,
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
   * TTS语音合成
   * @param params TTS参数
   * @returns {Promise<TTSExecutionResult>} 音频结果
   */
  async executeTTS(params: TTSExecutionParams): Promise<TTSExecutionResult> {
    const { model, text, voice, speed } = params;

    this.logger.debug(`TTS语音合成: model=${model.code}, voice=${voice || 'alloy'}, speed=${speed || 1.0}`);

    const openai = new OpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
      baseURL: model.endpoint || 'https://api.openai.com/v1',
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
   * ASR语音识别
   * @param params ASR参数
   * @returns {Promise<ASRExecutionResult>} 识别结果
   */
  async executeASR(params: ASRExecutionParams): Promise<ASRExecutionResult> {
    const { model, audio, format } = params;

    this.logger.debug(`ASR语音识别: model=${model.code}, format=${format || 'wav'}`);

    const openai = new OpenAI({
      apiKey: model.apiKey || process.env.OPENAI_API_KEY,
      baseURL: model.endpoint || 'https://api.openai.com/v1',
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

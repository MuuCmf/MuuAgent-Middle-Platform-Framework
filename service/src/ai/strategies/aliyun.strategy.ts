import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';
import {
  TTSExecutionParams,
  TTSExecutionResult,
  ASRExecutionParams,
  ASRExecutionResult,
} from './provider.strategy.interface';

/**
 * 阿里云通义策略
 * 使用阿里云 DashScope API 进行语音合成与识别
 * 注意：DashScope TTS/ASR 使用固定 API 路径，不兼容 OpenAI 格式
 */
@Injectable()
export class AliyunStrategy extends BaseStrategy {
  readonly name = '阿里云通义';
  readonly providerId = 'aliyun';

  /** DashScope API 基础地址 */
  private readonly dashscopeBaseURL = 'https://dashscope.aliyuncs.com';

  /**
   * TTS语音合成
   * 调用 DashScope 多模态生成接口进行非实时语音合成
   * @param params TTS参数
   * @returns {Promise<TTSExecutionResult>} 音频结果
   */
  async executeTTS(params: TTSExecutionParams): Promise<TTSExecutionResult> {
    const { model, text, voice, speed } = params;

    this.logger.debug(`DashScope TTS: model=${model.code}, voice=${voice || 'longanyang'}, speed=${speed || 1.0}`);

    const apiKey = model.apiKey || process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      throw new HttpException('DashScope API Key 未配置', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await fetch(
        `${this.dashscopeBaseURL}/api/v1/services/aigc/multimodal-generation/generation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.code || 'qwen3-tts-flash',
            input: {
              text,
              voice: voice || 'longanyang',
            },
            parameters: {
              ...(speed ? { speed } : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new HttpException(
          `DashScope API 错误: ${response.status} ${errorText}`,
          response.status,
        );
      }

      const result = await response.json() as any;

      const audioUrl = result?.output?.audio?.url;
      const duration = result?.output?.audio?.duration;

      if (!audioUrl) {
        throw new HttpException('DashScope TTS 未返回音频 URL', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.debug(`DashScope TTS 成功: duration=${duration}s, downloading audio...`);

      const audioResponse = await fetch(audioUrl);

      if (!audioResponse.ok) {
        throw new HttpException(
          `下载音频文件失败: ${audioResponse.status}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      const audioData = audioBuffer.toString('base64');

      return {
        audioData,
        format: 'mp3',
        duration,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `DashScope TTS 失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ASR语音识别
   * @param params ASR参数
   * @returns {Promise<ASRExecutionResult>} 识别结果
   */
  async executeASR(params: ASRExecutionParams): Promise<ASRExecutionResult> {
    const { model, audio, format } = params;

    this.logger.debug(`DashScope ASR: model=${model.code}, format=${format || 'wav'}`);

    const apiKey = model.apiKey || process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      throw new HttpException('DashScope API Key 未配置', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await fetch(
        `${this.dashscopeBaseURL}/api/v1/services/aigc/multimodal-generation/generation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.code || 'qwen-audio-turbo',
            input: {
              audio: {
                audio_data: audio,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new HttpException(
          `DashScope ASR API 错误: ${response.status} ${errorText}`,
          response.status,
        );
      }

      const result = await response.json() as any;

      const text = result?.output?.choices?.[0]?.message?.content || '';

      return {
        text,
        language: 'zh',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `DashScope ASR 失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

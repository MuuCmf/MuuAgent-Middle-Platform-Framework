import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';
import { TTSExecutionParams,
  TTSExecutionResult,
  TTSStreamChunk,
  S2SExecutionParams,
  S2SExecutionResult,
  S2SStreamChunk,
  ASRExecutionParams,
  ASRExecutionResult,
} from './provider.strategy.interface';

/**
 * 火山引擎策略
 *
 * 使用火山引擎 (Volcengine/ByteDance) V3 HTTP Chunked 单向流式 API 进行语音合成。
 * 支持种子TTS 2.0 (seed-tts-2.0) 等大模型音色。
 *
 * API 参考: https://www.volcengine.com/docs/6561/1598757
 */
@Injectable()
export class VolcengineStrategy extends BaseStrategy {
  readonly name = '火山引擎';
  readonly providerId = 'volcengine';

  /** 火山引擎 V3 TTS API 基础地址 */
  private readonly baseURL = 'https://openspeech.bytedance.com';

  /** 默认音色（豆包语音合成模型2.0 音色） */
  private readonly defaultVoice = 'zh_female_qingxin';

  /** 默认音频采样率 */
  private readonly defaultSampleRate = 24000;

  /**
   * 获取 API Key
   * @param modelApiKey 模型中配置的API Key
   * @returns API Key
   */
  private resolveApiKey(modelApiKey?: string | null): string {
    if (modelApiKey) return modelApiKey.trim();
    return process.env.VOLCENGINE_API_KEY || '';
  }

  /**
   * 校验 API Key
   * @param apiKey API Key
   * @throws HttpException 若未配置
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new HttpException(
        '火山引擎 API 凭据未配置。请在模型的 apiKey 字段中填写控制台的 API Key 或 Access Token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 将通用语速（1.0=正常）转换为 V3 speech_rate（0=正常，范围 -50~100）
   *
   * V3 语速规则: -50=0.5倍速, 0=1.0倍速, 100=2.0倍速
   *
   * @param speed 通用语速值（1.0为正常）
   * @returns V3 speech_rate 值
   */
  private convertSpeed(speed?: number): number {
    if (speed === undefined || speed === null) return 0;
    const rate = Math.round((speed - 1) * 100);
    if (rate < -50) return -50;
    if (rate > 100) return 100;
    return rate;
  }

  /**
   * 从模型 config 中解析旧版控制台 App ID
   *
   * config 格式示例: {"appId": "123456789"}
   *
   * @param modelConfig 模型 config JSON 字符串
   * @returns App ID，若无则返回空
   */
  private resolveAppId(modelConfig?: string | null): string {
    if (!modelConfig) return '';
    try {
      const config = JSON.parse(modelConfig);
      return config.appId || '';
    } catch {
      return '';
    }
  }

  /**
   * 构建 V3 TTS 请求头
   *
   * 自动检测鉴权方式：
   * - 若 model.config 中配置了 appId → 旧版控制台 (X-Api-App-Id + X-Api-Access-Key)
   * - 否则 → 新版控制台 (X-Api-Key)
   *
   * @param apiKey API Key / Access Token
   * @param resourceId 资源ID（模型编码，如 seed-tts-2.0）
   * @param modelConfig 模型 config JSON 字符串（可选，用于检测旧版控制台 appId）
   * @returns HTTP 请求头
   */
  private buildHeaders(
    apiKey: string,
    resourceId: string,
    modelConfig?: string | null,
  ): Record<string, string> {
    const appId = this.resolveAppId(modelConfig);
    const headers: Record<string, string> = {
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json',
    };

    if (appId) {
      headers['X-Api-App-Id'] = appId;
      headers['X-Api-Access-Key'] = apiKey;
    } else {
      headers['X-Api-Key'] = apiKey;
    }

    return headers;
  }

  /**
   * 构建 V3 TTS 请求体
   * @param text 合成文本
   * @param voice 音色标识（speaker）
   * @param speed 语速（1.0=正常）
   * @returns V3 请求体 JSON 字符串
   */
  private buildRequestBody(
    text: string,
    voice?: string,
    speed?: number,
  ): string {
    return JSON.stringify({
      user: {
        uid: crypto.randomUUID(),
      },
      namespace: 'BidirectionalTTS',
      req_params: {
        text,
        speaker: voice || this.defaultVoice,
        audio_params: {
          format: 'mp3',
          sample_rate: this.defaultSampleRate,
          speech_rate: this.convertSpeed(speed),
          loudness_rate: 0,
        },
      },
    });
  }

  /**
   * 解析火山引擎 V3 响应行数据
   *
   * V3 API 返回逐行 JSON（类似 NDJSON），每行包含 event、audio 等字段。
   *
   * @param body 响应体文本
   * @returns 解析出的 JSON 对象数组
   */
  private parseResponseLines(body: string): any[] {
    this.logger.debug(`响应体长度: ${body.length}`);
    return body
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          //this.logger.debug(`解析响应行: ${JSON.stringify(parsed)}`);
          return parsed;
        } catch {
          this.logger.debug(`无法解析行: ${line.substring(0, 100)}...`);
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * 从 V3 响应行中提取音频数据（非流式模式下拼接所有块）
   * @param lines 响应行数组
   * @returns 拼接后的 base64 音频
   * @throws HttpException 若有错误且无音频
   */
  private extractAudioFromLines(lines: any[]): string {
    let allAudioData = '';
    let errorMsg = '';

    for (const line of lines) {
      const audioData = line.data || line.audio;
      if (audioData) {
        allAudioData += audioData;
        this.logger.debug(`拼接音频块, 当前总长度: ${allAudioData.length}`);
      }
      // 检查是否有错误 (成功码: 0 和 20000000)
      const successCodes = [0, 20000000];
      if (line.event === 'error' || (line.code !== undefined && !successCodes.includes(line.code))) {
        errorMsg = line.message || line.error || `火山引擎错误码: ${line.code}`;
        this.logger.error(`检测到错误: ${errorMsg}`);
      }
    }

    if (errorMsg && !allAudioData) {
      throw new HttpException(errorMsg, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.debug(`最终音频数据长度: ${allAudioData.length}`);
    return allAudioData;
  }

  /**
   * TTS语音合成（非实时）
   *
   * 通过 HTTP POST 调用火山引擎 V3 HTTP Chunked API，收集所有块后返回完整音频。
   *
   * @param params TTS参数
   * @returns {Promise<TTSExecutionResult>} 音频结果
   */
  async executeTTS(params: TTSExecutionParams): Promise<TTSExecutionResult> {
    const { model, text, voice, speed } = params;

    this.logger.debug(
      `Volcengine V3 TTS: model=${model.code}, voice=${voice || this.defaultVoice}, speed=${speed ?? 1.0}`,
    );

    const apiKey = this.resolveApiKey(model.apiKey);
    this.validateApiKey(apiKey);

    try {
      const response = await fetch(`${this.baseURL}/api/v3/tts/unidirectional`, {
        method: 'POST',
        headers: this.buildHeaders(apiKey, model.code, model.config),
        body: this.buildRequestBody(text, voice, speed),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new HttpException(
          `火山引擎 V3 API 错误: ${response.status} ${errorText}`,
          response.status,
        );
      }

      const responseText = await response.text();
      const lines = this.parseResponseLines(responseText);
      const audioData = this.extractAudioFromLines(lines);

      if (!audioData) {
        throw new HttpException('火山引擎 V3 TTS 未返回音频数据', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        audioData,
        format: 'mp3',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `火山引擎 V3 TTS 失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 流式TTS合成
   *
   * 通过 HTTP POST 调用火山引擎 V3 HTTP Chunked API，使用 ReadableStream 逐块 yield 音频数据。
   *
   * @param params TTS执行参数
   * @returns 音频块异步迭代器
   */
  async *executeTTSStream(
    params: TTSExecutionParams,
  ): AsyncIterable<TTSStreamChunk> {
    const { model, text, voice, speed } = params;

    this.logger.debug(
      `Volcengine V3 流式TTS: model=${model.code}, voice=${voice || this.defaultVoice}`,
    );

    const apiKey = this.resolveApiKey(model.apiKey);
    this.validateApiKey(apiKey);

    const response = await fetch(`${this.baseURL}/api/v3/tts/unidirectional`, {
      method: 'POST',
      headers: this.buildHeaders(apiKey, model.code, model.config),
      body: this.buildRequestBody(text, voice, speed),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new HttpException(
        `火山引擎 V3 API 错误: ${response.status} ${errorText}`,
        response.status,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new HttpException('火山引擎 V3 API 响应体不可读', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let seq = 0;
    let hasError = false;
    let errorMessage = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed);
            //this.logger.debug(`收到响应: ${JSON.stringify(parsed)}`);
          } catch {
            this.logger.debug(`无法解析的行: ${trimmed}`);
            continue;
          }

          // 检查是否有错误 (成功码: 0 和 20000000)
          const successCodes = [0, 20000000];
          if (parsed.event === 'error' || (parsed.code !== undefined && !successCodes.includes(parsed.code))) {
            hasError = true;
            errorMessage = parsed.message || parsed.error || `火山引擎错误码: ${parsed.code}`;
            this.logger.error(`火山引擎 API 错误: ${errorMessage}`);
            continue;
          }

          // 火山引擎 V3 API 使用 data 字段存储音频
          const audioData = parsed.data || parsed.audio;
          if (audioData) {
            const isLast = parsed.is_last === true;

            this.logger.debug(`收到音频块, seq=${seq}, isLast=${isLast}, 长度=${audioData.length}`);

            yield {
              audioData: audioData,
              format: 'mp3',
              sequence: seq++,
              isLast,
              sampleRate: this.defaultSampleRate,
            };

            if (isLast) return;
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          this.logger.debug(`处理缓冲区末尾: ${JSON.stringify(parsed)}`);
          const audioData = parsed.data || parsed.audio;
          if (audioData) {
            yield {
              audioData: audioData,
              format: 'mp3',
              sequence: seq++,
              isLast: true,
              sampleRate: this.defaultSampleRate,
            };
          }
        } catch {
          // ignore malformed final chunk
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (hasError) {
      throw new HttpException(`火山引擎 V3 TTS 错误: ${errorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (seq === 0) {
      throw new HttpException('火山引擎 V3 流式TTS未返回音频数据', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ===================== ASR 语音识别 =====================

  /**
   * ASR语音识别
   *
   * 调用火山引擎 V3 ASR BigModel API 进行语音识别。
   * 使用两步流程：提交任务 -> 轮询查询结果
   * API 参考: https://www.volcengine.com/docs/6561/1354869
   *
   * @param params ASR执行参数
   * @returns {Promise<ASRExecutionResult>} 识别结果
   */
  async executeASR(params: ASRExecutionParams): Promise<ASRExecutionResult> {
    const { model, audio, format } = params;

    this.logger.debug(
      `Volcengine ASR: model=${model.code}, format=${format || 'wav'}`,
    );

    const apiKey = this.resolveApiKey(model.apiKey);
    this.validateApiKey(apiKey);

    try {
      const requestId = crypto.randomUUID();
      
      // 构建提交请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': model.code,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      };

      this.logger.debug(`Volcengine ASR: 提交任务，requestId=${requestId}`);

      // 第一步：提交任务
      const submitRequestBody = {
        user: {
          uid: 'MuuAI',
        },
        audio: {
          data: audio,
          format: format || 'wav',
          codec: 'raw',
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_ddc: false,
          enable_speaker_info: false,
          enable_channel_split: false,
          show_utterances: false,
          vad_segment: false,
          sensitive_words_filter: '',
        },
      };

      const submitResponse = await fetch(`${this.baseURL}/api/v3/auc/bigmodel/submit`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(submitRequestBody),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text().catch(() => '');
        this.logger.error(`火山引擎 ASR 提交任务失败: ${submitResponse.status} ${errorText}`);
        throw new HttpException(
          `火山引擎 ASR 提交任务失败: ${submitResponse.status} ${errorText}`,
          submitResponse.status,
        );
      }

      this.logger.debug(`Volcengine ASR: 任务提交成功，开始轮询结果`);

      // 第二步：轮询查询结果（最多轮询 30 次，每次间隔 500ms）
      const maxPolls = 30;
      const pollInterval = 500;
      
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        this.logger.debug(`Volcengine ASR: 查询结果 (${i + 1}/${maxPolls})`);

        const queryResponse = await fetch(`${this.baseURL}/api/v3/auc/bigmodel/query`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({}),
        });

        if (!queryResponse.ok) {
          const errorText = await queryResponse.text().catch(() => '');
          this.logger.error(`火山引擎 ASR 查询失败: ${queryResponse.status} ${errorText}`);
          throw new HttpException(
            `火山引擎 ASR 查询失败: ${queryResponse.status} ${errorText}`,
            queryResponse.status,
          );
        }

        const result = await queryResponse.json() as any;
        
        // 如果返回空对象，说明还在处理中
        if (!result || Object.keys(result).length === 0) {
          continue;
        }

        // 检查是否有结果
        if (result.result?.text) {
          const text = result.result.text;
          this.logger.debug(`Volcengine ASR: 识别成功，text="${text}"`);

          return {
            text,
            language: 'zh',
            confidence: result.result.confidence,
          };
        }

        // 检查是否有错误
        if (result.code && ![0, 20000000].includes(result.code)) {
          throw new HttpException(
            `火山引擎 ASR 错误: ${result.message || `错误码 ${result.code}`}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `火山引擎 ASR 超时：在 ${maxPolls * pollInterval / 1000} 秒内未获取到结果`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `火山引擎 ASR 失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===================== S2S 端到端语音 =====================

  /**
   * S2S WebSocket API 基础地址
   *
   * 注意：火山引擎端到端实时语音大模型使用 WebSocket 协议，而非 HTTP POST。
   * 正确的 endpoint 是：wss://openspeech.bytedance.com/api/v3/realtime/dialogue
   *
   * 参考：https://www.volcengine.com/docs/6561/1594356
   */
  private readonly s2sWebSocketURL = 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue';

  /**
   * S2S端到端语音（非流式）
   *
   * ⚠️ 注意：火山引擎 S2S API 仅支持 WebSocket 流式交互，不支持 HTTP POST。
   * 此方法已废弃，请使用 executeS2SStream 或直接使用 WebSocket 连接。
   *
   * @param params S2S执行参数
   * @returns {Promise<S2SExecutionResult>} 语音结果
   * @throws HttpException 始终抛出错误，提示使用 WebSocket
   */
  async executeS2S(params: S2SExecutionParams): Promise<S2SExecutionResult> {
    throw new HttpException(
      '火山引擎 S2S API 仅支持 WebSocket 流式交互，请使用 executeS2SStream 或建立 WebSocket 连接。' +
      '参考文档：https://www.volcengine.com/docs/6561/1594356',
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * 流式S2S端到端语音（WebSocket）
   *
   * ⚠️ 注意：此方法需要实现 WebSocket 客户端连接。
   * 火山引擎 S2S API 使用 WebSocket 协议进行双向音频流交互。
   *
   * **架构说明：**
   * 1. 客户端 WebSocket → 服务端 Gateway → Session Manager
   * 2. Session Manager → 火山引擎 WebSocket → 接收音频流
   * 3. Session Manager → Gateway → 客户端 WebSocket
   *
   * **音频格式要求：**
   * - 输入：PCM, 单声道, 16000Hz, int16, 小端序
   * - 输出：OGG Opus（默认）或 PCM (24000Hz, 32bit/16bit)
   *
   * **WebSocket 事件：**
   * - StartSession (100): 建立会话
   * - TaskRequest (200): 发送音频数据
   * - FinishSession (102): 结束会话
   * - TTSResponse (352): 接收音频数据
   *
   * TODO: 实现 WebSocket 客户端连接和双向音频流管理
   *
   * @param params S2S执行参数
   * @returns 音频块异步迭代器
   */
  async *executeS2SStream(params: S2SExecutionParams): AsyncIterable<S2SStreamChunk> {
    const { model, audio, voice } = params;

    this.logger.warn(
      `火山引擎 S2S WebSocket 未实现，请参考文档：https://www.volcengine.com/docs/6561/1594356`,
    );

    // TODO: 实现 WebSocket 连接
    // 1. 建立 WebSocket 连接：wss://openspeech.bytedance.com/api/v3/realtime/dialogue
    // 2. 发送 StartSession 事件
    // 3. 发送 TaskRequest 事件（音频数据）
    // 4. 接收 TTSResponse 事件（音频流）
    // 5. 发送 FinishSession 事件

    throw new HttpException(
      '火山引擎 S2S WebSocket 实现待完成。' +
      '正确的 API endpoint: wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
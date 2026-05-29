import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';
import {
  TTSExecutionParams,
  TTSExecutionResult,
  TTSStreamChunk,
  ASRExecutionParams,
  ASRExecutionResult,
} from './provider.strategy.interface';
import * as WebSocket from 'ws';

/**
 * 阿里云策略
 * 使用阿里云 DashScope API 进行语音合成与识别
 * 注意：DashScope TTS/ASR 使用固定 API 路径，不兼容 OpenAI 格式
 */
@Injectable()
export class AliyunStrategy extends BaseStrategy {
  readonly name = '阿里云';
  readonly providerId = 'aliyun';

  /**
   * 阿里云 Qwen-TTS-Realtime 系列模型支持的系统音色列表
   *
   * Qwen3-TTS-Flash-Realtime / Qwen-TTS-Realtime 使用英文风格音色名，
   * 与 CosyVoice 系列（longxiaoxia 等）完全不同。
   * 当语音配置中的 voiceId 不在该列表中时，说明语音为其他 Provider 的标识
   * （如 OpenAI 的 alloy/nova），此时 fallback 到默认语音 Cherry。
   *
   * 参考: https://help.aliyun.com/zh/model-studio/multimodal-timbre-list
   */
  private static readonly ALIYUN_QWEN_VOICES = new Set([
    'Cherry', 'Serena', 'Ethan', 'Chelsie', 'Momo', 'Vivian',
    'Moon', 'Maia', 'Kai', 'Nofish', 'Bella', 'Jennifer',
    'Dylan', 'Sunny', 'Aiden', 'Ryan', 'Soji',
  ]);

  /**
   * 解析并校验语音标识
   *
   * 确保传入 DashScope 的 voice 是阿里云 Qwen-TTS 支持的音色名。
   * 如果不支持，使用默认语音 Cherry 并记录警告。
   *
   * @param voice 语音标识（可能来自其他 Provider 的语音配置）
   * @returns 阿里云兼容的语音标识
   */
  private resolveVoice(voice?: string): string {
    const defaultVoice = 'Cherry';
    if (!voice) return defaultVoice;
    if (AliyunStrategy.ALIYUN_QWEN_VOICES.has(voice)) return voice;
    this.logger.warn(`阿里云 Qwen-TTS 不支持语音 "${voice}"，自动切换为默认语音 "${defaultVoice}"`);
    return defaultVoice;
  }

  /**
   * PCM原始音频数据转WAV（16位单声道）
   *
   * @param pcmData PCM数据Buffer
   * @param sampleRate 采样率
   * @returns WAV格式Buffer
   */
  private pcmToWav(pcmData: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const wavBuffer = Buffer.alloc(totalSize);
    let offset = 0;

    const write = (str: string) => { wavBuffer.write(str, offset); offset += str.length; };
    const writeU32 = (val: number) => { offset = wavBuffer.writeUInt32LE(val, offset); };
    const writeU16 = (val: number) => { offset = wavBuffer.writeUInt16LE(val, offset); };

    write('RIFF');
    writeU32(totalSize - 8);
    write('WAVE');
    write('fmt ');
    writeU32(16);
    writeU16(1);           // PCM格式
    writeU16(numChannels); // 单声道
    writeU32(sampleRate);  // 采样率
    writeU32(byteRate);    // 字节率
    writeU16(blockAlign);  // 块对齐
    writeU16(bitsPerSample); // 位深
    write('data');
    writeU32(dataSize);

    pcmData.copy(wavBuffer, offset);

    return wavBuffer;
  }

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

    const resolvedVoice = this.resolveVoice(voice);

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
              voice: resolvedVoice,
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
   * 流式TTS合成（Qwen-TTS-Realtime WebSocket）
   *
   * 使用阿里云 Qwen-TTS-Realtime 系列模型的 WebSocket 接口
   * 进行实时流式语音合成。
   *
   * @param params TTS执行参数
   * @returns 音频块异步迭代器
   */
  async *executeTTSStream(
    params: TTSExecutionParams,
  ): AsyncIterable<TTSStreamChunk> {
    const { model, text, voice, speed } = params;

    // model.code 从数据库获取（如 qwen3-tts-flash-realtime），直接使用
    const modelCode = model.code || 'qwen3-tts-flash-realtime';
    const resolvedVoice = this.resolveVoice(voice);

    this.logger.debug(
      `Qwen-TTS 流式: model=${modelCode}, voice=${resolvedVoice}`,
    );

    const apiKey = model.apiKey || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new HttpException('DashScope API Key 未配置', HttpStatus.BAD_REQUEST);
    }

    const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${modelCode}`;

    this.logger.debug(`Qwen-TTS 尝试 WebSocket 流式: url=${wsUrl}`);

    for await (const chunk of this.tryWebSocketStream(
      wsUrl, apiKey, text, resolvedVoice, speed,
    )) {
      yield chunk;
    }
  }

  /**
   * 尝试 WebSocket 流式合成
   * 如果模型不支持流式或超时，抛出异常回退到 REST API
   */
  private async *tryWebSocketStream(
    wsUrl: string,
    apiKey: string,
    text: string,
    voice?: string,
    speed?: number,
  ): AsyncIterable<TTSStreamChunk> {
    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'muu-agent-service/1.0',
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('WebSocket 连接超时(10s)')),
        10000,
      );
      ws.onopen = () => { clearTimeout(timeout); resolve(); };
      ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket 连接失败')); };
    });

    const sessionCreated = await this.waitForEventSafe(ws, 'session.created', 15000);
    if (!sessionCreated) {
      ws.close();
      throw new Error('未收到 session.created');
    }

    const sessionUpdateEventId = crypto.randomUUID();
    ws.send(JSON.stringify({
      event_id: sessionUpdateEventId,
      type: 'session.update',
      session: {
        voice: voice,
        mode: 'commit', // 对话式 AI 场景使用 commit 模式，需显式提交触发合成
        response_format: 'pcm_24000hz_mono_16bit',
      },
    }));

    // 等待 session.update 确认（使用 event_id 匹配）
    await this.waitForEventSafe(ws, 'session.updated', 10000);

    let sequence = 0;

    const messageQueue: string[] = [];
    let messageResolve: ((msg: string) => void) | null = null;
    let wsClosed = false;

    const messageHandler = (raw: WebSocket.Data) => {
      if (wsClosed) return;
      const msg = typeof raw === 'string' ? raw : raw.toString();
      if (messageResolve) {
        const resolve = messageResolve;
        messageResolve = null;
        resolve(msg);
      } else {
        messageQueue.push(msg);
      }
    };

    ws.on('message', messageHandler);
    ws.on('close', () => { wsClosed = true; });

    const nextMsg = (timeoutMs = 30000): Promise<string | 'TIMEOUT'> => {
      if (messageQueue.length > 0) {
        return Promise.resolve(messageQueue.shift()!);
      }
      return new Promise<string | 'TIMEOUT'>(resolve => {
        messageResolve = resolve;
        setTimeout(() => {
          if (messageResolve) {
            const r = messageResolve;
            messageResolve = null;
            r('TIMEOUT');
          }
        }, timeoutMs);
      });
    };

    try {
      // 一次性发送全部文本
      // commit 模式下需要先 append 再 commit 触发合成
      this.logger.debug(`Qwen-TTS 发送文本：len=${text.length}, text="${text.slice(0, 60)}..."`);

      // 1. 添加文本到缓冲区
      const appendEventId = crypto.randomUUID();
      ws.send(JSON.stringify({
        event_id: appendEventId,
        type: 'input_text_buffer.append',
        text,
      }));

      // 2. 提交缓冲区触发合成（commit 模式必须显式提交）
      const commitEventId = crypto.randomUUID();
      ws.send(JSON.stringify({
        event_id: commitEventId,
        type: 'input_text_buffer.commit',
      }));
      this.logger.debug(`Qwen-TTS 已提交缓冲区，等待音频响应...`);

      let audioBuffer = Buffer.alloc(0);
      const startTime = Date.now();
      let gotAudio = false;
      const YIELD_CHUNK_SIZE = 16384; // 增大音频块大小，减少网络传输频率
      const OVERALL_TIMEOUT = 15000; // 缩短超时时间，快速失败
      let lastAudioTime = Date.now();

      // 持续接收事件，直到响应完成或超时
      while (true) {
        const elapsed = Date.now() - startTime;
        const remaining = OVERALL_TIMEOUT - elapsed;
        if (remaining <= 0) {
          if (!gotAudio) {
            this.logger.warn(`Qwen-TTS 流式合成总超时 (${OVERALL_TIMEOUT}ms)`);
          } else {
            this.logger.debug(`Qwen-TTS 合成完成，已接收音频`);
          }
          break;
        }

        // 使用较短超时，快速检测无响应
        this.logger.debug(`Qwen-TTS 等待消息中... (已等待 ${elapsed}ms)`);
        const message = await nextMsg(Math.min(remaining, 2000));

        if (message === 'TIMEOUT') {
          // 如果超过 2 秒没有收到任何消息，且已收到音频，则认为完成
          if (gotAudio) {
            this.logger.debug(`Qwen-TTS 接收完成 (已接收音频，2s 无新数据)`);
            break;
          }
          this.logger.warn(`Qwen-TTS 接收超时 (2s 无响应)`);
          break;
        }

        if (typeof message !== 'string') continue;

        let data: Record<string, unknown>;
        try { data = JSON.parse(message); } catch { continue; }

        const type = data.type as string | undefined;
        
        // 调试：记录所有收到的消息类型
        this.logger.debug(`Qwen-TTS 收到消息类型: ${type || 'undefined'}`);

        if (type === 'response.audio.delta') {
          const delta = data.delta as string;
          if (delta) {
            const deltaBuf = Buffer.from(delta, 'base64');
            audioBuffer = Buffer.concat([audioBuffer, deltaBuf]);
            gotAudio = true;
            lastAudioTime = Date.now();

            while (audioBuffer.length >= YIELD_CHUNK_SIZE) {
              const chunk = audioBuffer.subarray(0, YIELD_CHUNK_SIZE);
              audioBuffer = audioBuffer.subarray(YIELD_CHUNK_SIZE);
              yield {
                audioData: chunk.toString('base64'),
                format: 'pcm',
                sequence: sequence++,
                isLast: false,
                sampleRate: 24000,
              };
            }
          }
        } else if (type === 'response.done' || type === 'response.audio.done') {
          // 调试：查看完整的 done 响应
          this.logger.debug(`Qwen-TTS 完成响应 (${type}): ${JSON.stringify(data)}`);
          // 服务端明确告知完成，yield 当前缓冲区后立即结束
          if (audioBuffer.length > 0) {
            yield {
              audioData: audioBuffer.toString('base64'),
              format: 'pcm',
              sequence: sequence++,
              isLast: true,
              sampleRate: 24000,
            };
            audioBuffer = Buffer.alloc(0);
          }
          
          // 如果没有收到任何音频数据，抛出错误
          if (!gotAudio) {
            this.logger.warn(`Qwen-TTS 未返回音频数据，可能是配额问题或配置错误`);
            throw new Error('Qwen-TTS 服务未返回音频数据');
          }
          
          break;
        } else if (type === 'error' || type === 'response.error') {
          const errMsg = (data.error as any)?.message || message.slice(0, 200);
          this.logger.warn(`Qwen-TTS 错误: ${errMsg}`);
          if (gotAudio) break;
          throw new Error(`DashScope 合成错误: ${errMsg}`);
        } else if (type === 'input_text_buffer.committed') {
          this.logger.debug(`Qwen-TTS 缓冲区已提交，准备接收音频...`);
        } else if (type !== 'session.created' &&
                   type !== 'response.created' &&
                   type !== 'session.updated' &&
                   type !== 'response.output_item.added' &&
                   type !== 'response.content_part.added' &&
                   type !== 'response.content_part.done' &&
                   type !== 'response.output_item.done' &&
                   type !== 'input_text_buffer.committed' &&
                   type !== undefined) {
          // 记录所有未知事件类型
          this.logger.debug(`Qwen-TTS 未处理事件(${type}): ${message.slice(0, 200)}`);
        } else if (type !== undefined) {
          // 记录已处理但不产生输出的事件
          this.logger.debug(`Qwen-TTS 跳过事件(${type})`);
        }
      }

      if (audioBuffer.length > 0) {
        yield {
          audioData: audioBuffer.toString('base64'),
          format: 'pcm',
          sequence: sequence++,
          isLast: true,
          sampleRate: 24000,
        };
      }

      if (!gotAudio) {
        this.logger.warn('Qwen-TTS WebSocket 未收到音频数据');
      }
    } finally {
      ws.off('message', messageHandler);
      const finishEventId = crypto.randomUUID();
      try { ws.send(JSON.stringify({ event_id: finishEventId, type: 'session.finish' })); } catch {}
      try { ws.close(); } catch {}
    }
  }

  /**
   * 等待指定类型的服务端事件（超时后自动清理监听器）
   *
   * @param ws WebSocket 实例
   * @param targetType 目标事件类型
   * @param timeoutMs 超时毫秒
   * @returns 事件载荷，超时返回 null
   */
  private waitForEventSafe(
    ws: WebSocket,
    targetType: string,
    timeoutMs = 15000,
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.off('message', handler);
        this.logger.warn(`等待事件 ${targetType} 超时，继续流程...`);
        resolve(null);
      }, timeoutMs);

      const handler = (raw: WebSocket.Data) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === targetType) {
            clearTimeout(timeout);
            ws.off('message', handler);
            resolve(data as Record<string, unknown>);
          }
        } catch {
          // ignore parse error
        }
      };

      ws.on('message', handler);
    });
  }

  /**
   * 将文本按句子切分
   *
   * @param text 原始文本
   * @returns 句子数组
   */
  private splitSentences(text: string): string[] {
    if (!text) return [];

    const segments = text.split(/(?<=[。！？.!?\n……])/);
    const sentences: string[] = [];
    let buffer = '';

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      buffer += trimmed;

      if (buffer.length >= 10 || /[。！？.!?\n]$/.test(buffer)) {
        sentences.push(buffer);
        buffer = '';
      }
    }

    if (buffer.trim()) {
      sentences.push(buffer.trim());
    }

    return sentences;
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

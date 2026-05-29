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
    const { model, text, voice, speed, mode } = params;
    const ttsMode = mode || 'server_commit';
    const modelCode = model.code || 'qwen3-tts-flash-realtime';
    const resolvedVoice = this.resolveVoice(voice);

    this.logger.debug(`Qwen-TTS: model=${modelCode}, voice=${resolvedVoice}, mode=${ttsMode}`);

    const apiKey = model.apiKey || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new HttpException('DashScope API Key 未配置', HttpStatus.BAD_REQUEST);
    }

    const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${modelCode}`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'muu-agent-service/1.0',
      },
    });

    // 连接
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket 连接超时(10s)')), 10000);
        ws.onopen = () => { clearTimeout(timer); resolve(); };
        ws.onerror = (e) => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')); };
      });
    } catch (e) {
      ws.close();
      throw e;
    }

    // 统一消息队列
    const msgQueue: string[] = [];
    let msgResolve: ((m: string) => void) | null = null;
    let closed = false;

    ws.on('message', (raw: WebSocket.Data) => {
      if (closed) return;
      const m = typeof raw === 'string' ? raw : raw.toString();
      if (msgResolve) { const r = msgResolve; msgResolve = null; r(m); }
      else msgQueue.push(m);
    });
    ws.on('close', () => { closed = true; });

    const next = (ms = 30000): Promise<string | 'TIMEOUT'> => {
      if (msgQueue.length > 0) return Promise.resolve(msgQueue.shift()!);
      return new Promise<string | 'TIMEOUT'>(resolve => {
        msgResolve = resolve;
        setTimeout(() => { if (msgResolve) { const r = msgResolve; msgResolve = null; r('TIMEOUT'); } }, ms);
      });
    };

    const send = (obj: object) => { ws.send(JSON.stringify(obj)); };

    try {
      // 1. 等待 session.created
      const first = await next(15000);
      if (first === 'TIMEOUT') throw new Error('未收到 session.created');
      try {
        const d = JSON.parse(first);
        if (d.type !== 'session.created') this.logger.warn(`首个消息不是 session.created: ${d.type}`);
      } catch { /* ignore */ }

      // 2. 发送 session.update
      send({
        event_id: crypto.randomUUID(),
        type: 'session.update',
        session: { voice: resolvedVoice, mode: ttsMode, response_format: 'pcm' },
      });

      // 3. 等待 session.updated（最多5秒）
      let updated = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const m = await next(Math.min(deadline - Date.now(), 2000));
        if (m === 'TIMEOUT') break;
        try {
          const d = JSON.parse(m);
          if (d.type === 'session.updated') { updated = true; break; }
          if (d.type === 'error' || d.type === 'response.error') {
            throw new Error(`session.update 错误: ${(d.error as any)?.message || m.slice(0, 200)}`);
          }
        } catch (e) {
          if ((e as Error).message?.startsWith('session.update')) throw e;
        }
      }
      if (!updated) this.logger.warn(`未收到 session.updated 确认，继续`);

      // 4. 发送文本
      send({ event_id: crypto.randomUUID(), type: 'input_text_buffer.append', text });
      if (ttsMode === 'commit') {
        send({ event_id: crypto.randomUUID(), type: 'input_text_buffer.commit' });
      }

      // 5. 通知服务端文本输入完毕，服务端会处理剩余缓冲区并发送 session.finished
      send({ event_id: crypto.randomUUID(), type: 'session.finish' });

      // 6. 接收音频，直到 session.finished 或连接关闭
      let seq = 0;
      let audioBuf = Buffer.alloc(0);
      let gotAudio = false;
      const CHUNK = 16384;

      while (!closed) {
        const m = await next(10000);
        if (m === 'TIMEOUT') {
          this.logger.warn('等待音频超时，结束接收');
          break;
        }

        let d: any;
        try { d = JSON.parse(m); } catch { continue; }

        if (d.type === 'response.audio.delta' && d.delta) {
          audioBuf = Buffer.concat([audioBuf, Buffer.from(d.delta, 'base64')]);
          gotAudio = true;
          while (audioBuf.length >= CHUNK) {
            yield { audioData: audioBuf.subarray(0, CHUNK).toString('base64'), format: 'pcm', sequence: seq++, isLast: false, sampleRate: 24000 };
            audioBuf = audioBuf.subarray(CHUNK);
          }
        } else if (d.type === 'session.finished') {
          // 服务端确认所有合成完成，flush 残余音频后退出
          if (audioBuf.length > 0) {
            yield { audioData: audioBuf.toString('base64'), format: 'pcm', sequence: seq++, isLast: true, sampleRate: 24000 };
            audioBuf = Buffer.alloc(0);
          }
          break;
        } else if (d.type === 'response.audio.done' || d.type === 'response.done') {
          // 单段合成完成，flush 残余音频，但继续等待后续段或 session.finished
          if (audioBuf.length > 0) {
            yield { audioData: audioBuf.toString('base64'), format: 'pcm', sequence: seq++, isLast: false, sampleRate: 24000 };
            audioBuf = Buffer.alloc(0);
          }
        } else if (d.type === 'error' || d.type === 'response.error') {
          const msg = d.error?.message || m.slice(0, 200);
          if (gotAudio) break;
          throw new Error(`DashScope 错误: ${msg}`);
        }
      }

      // flush 残余
      if (audioBuf.length > 0) {
        yield { audioData: audioBuf.toString('base64'), format: 'pcm', sequence: seq++, isLast: true, sampleRate: 24000 };
      }
      if (!gotAudio) this.logger.warn('Qwen-TTS 未收到音频数据');
    } finally {
      try { ws.close(); } catch { /* ignore */ }
    }
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

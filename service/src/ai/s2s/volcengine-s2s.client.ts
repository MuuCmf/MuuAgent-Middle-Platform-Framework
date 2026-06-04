import { Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import { VolcengineProtocolParser } from './volcengine-protocol.parser';

/**
 * 火山引擎实时语音客户端
 * WebSocket URL: wss://openspeech.bytedance.com/api/v3/realtime/dialogue
 */
export class VolcengineS2SClient extends EventEmitter {
  private readonly logger = new Logger(VolcengineS2SClient.name);
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private isConnected = false;
  private connectionStarted = false;
  private sessionStarted = false;

  constructor(
    private readonly apiKey: string,
    private readonly appKey: string,
    private readonly resourceId: string = 'volc.speech.dialog',
    private readonly wsUrl: string = 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
  ) {
    super();
  }

  /**
   * 连接到火山引擎服务
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // 构建 URL（S2S 可能不需要查询参数）
      const url = this.wsUrl;
      
      // 构建正确的鉴权头（根据火山引擎官方文档：https://www.volcengine.com/docs/6561/1594356）
      const headers: Record<string, string> = {
        'X-Api-Connect-Id': crypto.randomUUID(),
        'X-Api-Resource-Id': 'volc.speech.dialog', // 固定值！
      };

      if (this.appKey) {
        // 旧版控制台：X-Api-App-ID + X-Api-Access-Key + X-Api-App-Key
        headers['X-Api-App-ID'] = this.appKey; // 注意是 ID 不是 Key！
        headers['X-Api-Access-Key'] = this.apiKey;
        // 文档中提到 X-Api-App-Key 是固定值，但暂时先不加，测试一下
      } else {
        // 新版控制台：X-Api-Key
        headers['X-Api-Key'] = this.apiKey;
      }

      this.logger.debug(`Headers: ${JSON.stringify(Object.keys(headers))}`);
      this.logger.log(`Connecting to: ${this.wsUrl}`);

      this.ws = new WebSocket(url, { headers });

      this.ws.on('open', () => {
        this.logger.log('WebSocket connected');
        this.isConnected = true;
        this.handleOpen();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.logger.log(`WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this.connectionStarted = false;
        this.sessionStarted = false;
        this.emit('close', { code, reason });
      });

      // 等待 connectionStarted 事件
      this.once('connectionStarted', () => {
        resolve();
      });

      // 超时处理
      setTimeout(() => {
        if (!this.connectionStarted) {
          reject(new Error('Wait for ConnectionStarted timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 处理连接打开事件
   */
  private handleOpen(): void {
    //this.logger.log('Sending StartConnection...');
    const startConnectionMsg = VolcengineProtocolParser.buildStartConnection();
    //this.logger.debug('StartConnection frame:', startConnectionMsg.toString('hex'));
    this.ws!.send(startConnectionMsg);
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: Buffer): void {
    try {
      //this.logger.debug(`📥 收到原始数据，长度=${data.length}, hex=${data.toString('hex')}`);
      const parsed = VolcengineProtocolParser.parseFrame(data);
      this.logger.debug(`解析的消息: messageType=0x${parsed.messageType.toString(16)}, eventId=${parsed.eventId}, payloadSize=${parsed.payload.length}`);
      
      if (parsed.payload.length > 0) {
        this.logger.debug(`Payload: hex=${parsed.payload.toString('hex')}, utf8=${parsed.payload.toString('utf8')}`);
      }

      // 错误消息
      if (parsed.messageType === VolcengineProtocolParser.MessageType.ERROR_INFORMATION) {
        this.logger.error('收到错误消息:', parsed.payload.toString());
        const errorJson = VolcengineProtocolParser.parsePayloadJson<{
          code?: number;
          message?: string;
        }>(parsed.payload);
        this.emit('error', new Error(errorJson?.message || parsed.payload.toString()));
        return;
      }

      // 完整服务端响应 (FULL_SERVER_RESPONSE) - 可能包含文本和音频数据
      if (parsed.messageType === VolcengineProtocolParser.MessageType.FULL_SERVER_RESPONSE) {
        this.logger.debug(`✅ 收到 FULL_SERVER_RESPONSE: totalFrameSize=${data.length}`);
        
        // 结构类似 AUDIO_ONLY_RESPONSE: header(4) + eventId(4) + uuidSize(4) + UUID(N) + dataSize(4) + data(M)
        let dataOffset = 4; // header
        dataOffset += 4; // eventId
        const uuidSize = data.readInt32BE(dataOffset);
        dataOffset += 4 + uuidSize; // uuidSize + UUID
        
        let actualPayload = parsed.payload;
        
        if (dataOffset + 4 <= data.length) {
          const dataSize = data.readInt32BE(dataOffset);
          dataOffset += 4;
          const extraData = data.slice(dataOffset, dataOffset + dataSize);
          
          this.logger.debug(`FULL_SERVER_RESPONSE: extraData 长度=${extraData.length}, content=${extraData.toString('utf8').substring(0, 200)}`);
          
          // 检查是否是 JSON（以 { 或 [ 开头）
          if (extraData.length > 0 && (extraData[0] === 0x7B || extraData[0] === 0x5B)) {
            this.logger.debug(`FULL_SERVER_RESPONSE: 使用 extraData 作为 JSON payload`);
            actualPayload = extraData;
          }
        }
        
        // FULL_SERVER_RESPONSE 包含事件信息，使用解析后的 payload（或 extraData）
        if (parsed.eventId) {
          this.handleEvent(parsed.eventId, actualPayload);
        }
        return;
      }

      // 音频响应 (AUDIO_ONLY_RESPONSE)
      if (parsed.messageType === VolcengineProtocolParser.MessageType.AUDIO_ONLY_RESPONSE) {
        //this.logger.log(`✅ 收到 AUDIO_ONLY_RESPONSE: totalFrameSize=${data.length}`);

        // 帧结构：header(4) + eventId(4) + uuidSize(4) + UUID(N) + audioSize(4) + audioData(M)
        // 当前 parsed.payload 是 UUID，音频数据在 UUID 之后
        let audioOffset = 4; // 跳过 header
        audioOffset += 4; // 跳过 eventId
        const uuidSize = data.readInt32BE(audioOffset);
        audioOffset += 4 + uuidSize; // 跳过 uuidSize + UUID
        if (audioOffset + 4 <= data.length) {
          const audioSize = data.readInt32BE(audioOffset);
          audioOffset += 4;
          const audioData = data.slice(audioOffset, audioOffset + audioSize);
          //this.logger.log(`✅ AUDIO_ONLY_RESPONSE 音频数据: size=${audioData.length}, firstBytes=${audioData.slice(0, 8).toString('hex')}`);
          // 检查是否为 OGG Opus（以 OggS 开头）
          const isOgg = audioData.slice(0, 4).toString() === 'OggS';
          const isJson = audioData[0] === 0x7b; // '{'
          //this.logger.log(`🎵 AUDIO_ONLY_RESPONSE 格式: ${isOgg ? 'OGG_OPUS' : isJson ? 'JSON' : 'RAW_BINARY'}`);
          // AUDIO_ONLY_RESPONSE 返回的音频可能是 OGG Opus 或 PCM，传递格式信息
          const audioFormat = isOgg ? 'opus' : 'pcm';
          this.emit('audio', {
            audioData,
            isLast: false,
            format: audioFormat,
          });
        } else {
          this.logger.warn('AUDIO_ONLY_RESPONSE 无音频数据');
        }
        return;
      }

      // 处理事件
      if (parsed.eventId) {
        this.handleEvent(parsed.eventId, parsed.payload);
      }
    } catch (error) {
      this.logger.error('处理消息时出错:', error);
    }
  }

  /**
   * 处理事件
   * @param eventId 事件ID
   * @param payload 事件payload
   */
  private handleEvent(eventId: number, payload: Buffer): void {
    const eventName = Object.keys(VolcengineProtocolParser.EventType).find(k => VolcengineProtocolParser.EventType[k as keyof typeof VolcengineProtocolParser.EventType] === eventId) || 'unknown';
    this.logger.debug(`收到事件: ${eventId} (${eventName})`);

    switch (eventId) {
      case VolcengineProtocolParser.EventType.CONNECTION_STARTED:
        //this.logger.log('ConnectionStarted 事件已收到');
        this.connectionStarted = true;
        this.emit('connectionStarted');
        break;

      case VolcengineProtocolParser.EventType.CONNECTION_FAILED:
        //this.logger.error('ConnectionFailed 事件已收到');
        const connectionError = VolcengineProtocolParser.parsePayloadJson<{ error?: string }>(payload);
        this.emit('error', new Error(connectionError?.error || '连接失败'));
        break;

      case VolcengineProtocolParser.EventType.CONNECTION_FINISHED:
        //this.logger.log('ConnectionFinished 事件已收到');
        this.connectionStarted = false;
        this.emit('connectionFinished');
        break;

      case VolcengineProtocolParser.EventType.SESSION_STARTED:
        //this.logger.log('SessionStarted 事件已收到');
        this.sessionStarted = true;
        this.emit('sessionStarted');
        break;

      case VolcengineProtocolParser.EventType.SESSION_FAILED:
        //this.logger.error('SessionFailed 事件已收到');
        const sessionError = VolcengineProtocolParser.parsePayloadJson<{ error?: string }>(payload);
        this.emit('error', new Error(sessionError?.error || '会话失败'));
        break;

      case VolcengineProtocolParser.EventType.USAGE_RESPONSE:
        //this.logger.debug('UsageResponse 事件已收到（payload 为 requestId）');
        this.emit('usageInfo', payload.toString('utf8'));
        break;

      case VolcengineProtocolParser.EventType.ASR_INFO:
        //this.logger.debug('ASR_INFO 事件已收到（payload 为 requestId）');
        this.emit('asrInfo', payload.toString('utf8'));
        break;

      case VolcengineProtocolParser.EventType.ASR_RESPONSE:
        // ASR_RESPONSE payload 通常是 requestId UUID 字符串，部分版本可能返回 JSON
        // 先检查首字节判断是否为 JSON，避免对非 JSON 数据产生解析错误
        if (payload.length > 0 && (payload[0] === 0x7B || payload[0] === 0x5B)) {
          const asrJson = VolcengineProtocolParser.parsePayloadJson(payload);
          if (asrJson) {
            this.logger.debug(`ASR_RESPONSE JSON: ${JSON.stringify(asrJson)}`);
            this.emit('asrResponse', asrJson);
          } else {
            this.emit('asrResponse', payload.toString('utf8'));
          }
        } else {
          // 非 JSON 格式（requestId UUID），直接作为字符串传递
          this.emit('asrResponse', payload.toString('utf8'));
        }
        break;

      case VolcengineProtocolParser.EventType.ASR_ENDED:
        //this.logger.log('ASR_ENDED 事件已收到');
        this.emit('asrEnded');
        break;

      case VolcengineProtocolParser.EventType.TTS_SENTENCE_START:
        //this.logger.log('TTS_SENTENCE_START 事件已收到');
        this.emit('ttsSentenceStart');
        break;

      case VolcengineProtocolParser.EventType.TTS_SENTENCE_END:
        //this.logger.log('TTS_SENTENCE_END 事件已收到');
        this.emit('ttsSentenceEnd');
        break;

      case VolcengineProtocolParser.EventType.TTS_RESPONSE:
        //this.logger.debug(`TTS_RESPONSE 事件已收到, payload size=${payload.length}`);
        // TTS_RESPONSE 在 FULL_SERVER_RESPONSE 中下发，payload 为 JSON 格式
        // 结构：{ "payload": { "audio": "<base64_pcm>" } } 或 { "audio": "<base64_pcm>" }
        try {
          const ttsJson = JSON.parse(payload.toString('utf8'));
          const audioBase64 = ttsJson?.payload?.audio || ttsJson?.audio;
          if (audioBase64) {
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            this.logger.debug(`TTS_RESPONSE 解析成功: base64音频长度=${audioBase64.length}, PCM大小=${audioBuffer.length}`);
            this.emit('audio', {
              audioData: audioBuffer,
              isLast: false,
              format: 'pcm',
            });
          } else {
            // JSON 中没有音频字段，当做裸音频回退
            this.logger.warn('TTS_RESPONSE JSON 中未找到 audio 字段，回退为裸数据');
            this.emit('audio', {
              audioData: payload,
              isLast: false,
              format: 'pcm',
            });
          }
        } catch {
          // 不是 JSON 格式（兼容旧版），当做裸音频
          //this.logger.warn('TTS_RESPONSE payload 非 JSON 格式，按裸音频处理');
          this.emit('audio', {
            audioData: payload,
            isLast: false,
            format: 'pcm',
          });
        }
        break;

      case VolcengineProtocolParser.EventType.TTS_ENDED:
        this.logger.log('TTS_ENDED 事件已收到');
        // 发送最后一块音频标记，通知客户端音频流结束
        this.emit('audio', {
          audioData: Buffer.alloc(0),
          isLast: true,
          format: 'pcm',
        });
        this.emit('ttsEnded');
        break;

      case VolcengineProtocolParser.EventType.CHAT_RESPONSE:
        // CHAT_RESPONSE payload 可能是 JSON（含 query/content）或 requestId 字符串
        if (payload.length > 0 && (payload[0] === 0x7B || payload[0] === 0x5B)) {
          const chatResponse = VolcengineProtocolParser.parsePayloadJson(payload);
          this.logger.debug(`CHAT_RESPONSE JSON: ${JSON.stringify(chatResponse)}`);
          this.emit('chatResponse', chatResponse);
        } else {
          // 非 JSON 格式，记录原始内容便于排查
          this.logger.debug(`CHAT_RESPONSE 非 JSON: ${payload.toString('utf8')}`);
          this.emit('chatResponse', null);
        }
        break;

      case VolcengineProtocolParser.EventType.SESSION_FINISHED:
        this.logger.log('SESSION_FINISHED 事件已收到');
        this.sessionStarted = false;
        this.emit('sessionFinished');
        break;

      default:
        this.logger.debug('未处理的事件:', eventId);
    }
  }

  /**
   * 开始会话
   *
   * @param config 会话配置（voice、botName、systemRole）
   * @returns Promise<void>
   */
  async startSession(config?: { voice?: string; botName?: string; systemRole?: string }): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    this.sessionId = crypto.randomUUID();
    this.logger.log(`Starting session: ${this.sessionId}`);
    const startSessionMsg = VolcengineProtocolParser.buildStartSession(this.sessionId, config);
    this.logger.debug('StartSession frame:', startSessionMsg.toString('hex'));
    this.ws!.send(startSessionMsg);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Wait for SessionStarted timeout'));
      }, 30000);

      this.once('sessionStarted', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * 发送音频数据
   * 音频格式要求：PCM 16000Hz, 单声道, int16, 小端序
   */
  sendAudio(audioData: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot send audio: WebSocket not open');
      return;
    }

    if (!this.sessionStarted) {
      this.logger.warn('Cannot send audio: Session not started');
      return;
    }

    const taskRequestMsg = VolcengineProtocolParser.buildTaskRequest(this.sessionId, audioData);
    this.ws.send(taskRequestMsg);
  }

  /**
   * 结束会话
   */
  finishSession(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.sessionId) {
      return;
    }

    this.logger.log(`Finishing session: ${this.sessionId}`);
    const finishSessionMsg = VolcengineProtocolParser.buildFinishSession(this.sessionId);
    this.ws.send(finishSessionMsg);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.connectionStarted = false;
    this.sessionStarted = false;
  }
}

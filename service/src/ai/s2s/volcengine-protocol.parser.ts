import { Logger } from '@nestjs/common';

/**
 * 火山引擎实时语音协议解析器
 * 文档来源：https://blog.csdn.net/weixin_46306112/article/details/160038401
 */
export class VolcengineProtocolParser {
  private static readonly logger = new Logger(VolcengineProtocolParser.name);

  // 消息类型
  public static readonly MessageType = {
    FULL_CLIENT_REQUEST: 0x01,
    AUDIO_ONLY_REQUEST: 0x02,
    FULL_SERVER_RESPONSE: 0x09,
    AUDIO_ONLY_RESPONSE: 0x0B,
    ERROR_INFORMATION: 0x0F,
  };

  // 事件类型（根据火山引擎官方文档：https://www.volcengine.com/docs/6561/1594356）
  public static readonly EventType = {
    START_CONNECTION: 1, // 客户端事件
    FINISH_CONNECTION: 2,
    START_SESSION: 100,
    FINISH_SESSION: 102,
    TASK_REQUEST: 200,
    SAY_HELLO: 300,
    CHAT_TTS_TEXT: 500,
    CHAT_TEXT_QUERY: 501,
    CHAT_RAG_TEXT: 502,
    CONNECTION_STARTED: 50, // 服务端事件
    CONNECTION_FAILED: 51,
    CONNECTION_FINISHED: 52,
    SESSION_STARTED: 150,
    SESSION_FINISHED: 152,
    SESSION_FAILED: 153,
    USAGE_RESPONSE: 154,
    TTS_SENTENCE_START: 350,
    TTS_RESPONSE: 352,
    TTS_ENDED: 359,
    ASR_INFO: 450,
    ASR_RESPONSE: 451,
    ASR_ENDED: 459,
    CHAT_RESPONSE: 550,
  };

  /**
   * 构建消息头部（4字节）
   */
  private static buildHeader(
    messageType: number,
    hasEventId: boolean,
    hasSessionId: boolean,
  ): Buffer {
    const header = Buffer.alloc(4);
    // 字节0：协议版本(4bit, 1) + 头部大小(4bit, 1)
    header[0] = (1 << 4) | 1;
    // 字节1：消息类型(4bit) + flags(4bit)
    let flags = 0;
    if (hasEventId) flags |= 0x04; // bit 2
    if (hasSessionId) flags |= 0x08; // bit3
    header[1] = (messageType << 4) | flags;
    // 字节2：序列化(4bit, 1=JSON) + 压缩(4bit, 0=无)
    header[2] = (1 << 4) | 0;
    // 字节3：保留
    header[3] = 0;
    return header;
  }

  /**
   * 构建 StartConnection 消息
   */
  public static buildStartConnection(): Buffer {
    const header = this.buildHeader(
      this.MessageType.FULL_CLIENT_REQUEST,
      true,
      false,
    );
    const eventIdBuffer = Buffer.alloc(4);
    eventIdBuffer.writeInt32BE(this.EventType.START_CONNECTION, 0);
    const payload = Buffer.from(JSON.stringify({}), 'utf8');
    const payloadSizeBuffer = Buffer.alloc(4);
    payloadSizeBuffer.writeInt32BE(payload.length, 0);
    return Buffer.concat([header, eventIdBuffer, payloadSizeBuffer, payload]);
  }

  /**
   * 构建 StartSession 消息
   */
  public static buildStartSession(
    sessionId: string,
    config?: { voice?: string },
  ): Buffer {
    const header = this.buildHeader(
      this.MessageType.FULL_CLIENT_REQUEST,
      true,
      true,
    );
    const eventIdBuffer = Buffer.alloc(4);
    eventIdBuffer.writeInt32BE(this.EventType.START_SESSION, 0);
    const sessionIdBuffer = Buffer.from(sessionId, 'utf8');
    const sessionIdSizeBuffer = Buffer.alloc(4);
    sessionIdSizeBuffer.writeInt32BE(sessionIdBuffer.length, 0);

    // 使用默认配置，支持传入 voice (speaker)
    const defaultConfig = {
      dialog: {
        bot_name: '豆包',
        system_role: '',
        speaking_style: '',
        dialog_id: '',
        character_manifest: '',
        extra: {
          strict_audit: true,
          input_mod: '',
          model: 'O',
          enable_volc_websearch: false,
          volc_websearch_type: 'web_summary',
          volc_websearch_result_count: 10,
        },
      },
      asr: {
        extra: {
          end_smooth_window_ms: 1500,
          enable_custom_vad: false,
          enable_asr_twopass: false,
        },
      },
      tts: {
        speaker: config?.voice || 'zh_female_vv_jupiter_bigtts',
        audio_config: {
          format: 'pcm_s16le',
          sample_rate: 24000,
          channel: 1,
        },
      },
    };

    this.logger.debug('StartSession config:', JSON.stringify(defaultConfig, null, 2));

    const payload = Buffer.from(JSON.stringify(defaultConfig), 'utf8');
    const payloadSizeBuffer = Buffer.alloc(4);
    payloadSizeBuffer.writeInt32BE(payload.length, 0);
    return Buffer.concat([
      header,
      eventIdBuffer,
      sessionIdSizeBuffer,
      sessionIdBuffer,
      payloadSizeBuffer,
      payload,
    ]);
  }

  /**
   * 构建 TaskRequest 消息（发送音频）
   * 音频格式：PCM 16000Hz, 单声道, int16, 小端序
   * 注意：音频消息使用 AUDIO_ONLY_REQUEST 类型，不需要 JSON 序列化
   */
  public static buildTaskRequest(
    sessionId: string,
    audioData: Buffer,
  ): Buffer {
    const header = this.buildHeader(
      this.MessageType.AUDIO_ONLY_REQUEST,
      true, // 有 eventId (TASK_REQUEST=200)
      true, // 有 sessionId
    );
    const eventIdBuffer = Buffer.alloc(4);
    eventIdBuffer.writeInt32BE(this.EventType.TASK_REQUEST, 0);
    const sessionIdBuffer = Buffer.from(sessionId, 'utf8');
    const sessionIdSizeBuffer = Buffer.alloc(4);
    sessionIdSizeBuffer.writeInt32BE(sessionIdBuffer.length, 0);
    const payloadSizeBuffer = Buffer.alloc(4);
    payloadSizeBuffer.writeInt32BE(audioData.length, 0);
    return Buffer.concat([
      header,
      eventIdBuffer,
      sessionIdSizeBuffer,
      sessionIdBuffer,
      payloadSizeBuffer,
      audioData, // 直接使用原始音频数据，不需要 JSON 序列化
    ]);
  }

  /**
   * 构建 FinishSession 消息
   */
  public static buildFinishSession(sessionId: string): Buffer {
    const header = this.buildHeader(
      this.MessageType.FULL_CLIENT_REQUEST,
      true,
      true,
    );
    const eventIdBuffer = Buffer.alloc(4);
    eventIdBuffer.writeInt32BE(this.EventType.FINISH_SESSION, 0);
    const sessionIdBuffer = Buffer.from(sessionId, 'utf8');
    const sessionIdSizeBuffer = Buffer.alloc(4);
    sessionIdSizeBuffer.writeInt32BE(sessionIdBuffer.length, 0);
    const payload = Buffer.from(JSON.stringify({}), 'utf8');
    const payloadSizeBuffer = Buffer.alloc(4);
    payloadSizeBuffer.writeInt32BE(payload.length, 0);
    return Buffer.concat([
      header,
      eventIdBuffer,
      sessionIdSizeBuffer,
      sessionIdBuffer,
      payloadSizeBuffer,
      payload,
    ]);
  }

  /**
   * 解析服务端返回的消息
   */
  public static parseFrame(data: Buffer): {
    messageType: number;
    eventId?: number;
    sessionId?: string;
    payload: Buffer;
  } {
    //this.logger.debug('Parsing frame:', data.toString('hex'));
    let offset = 0;
    const header = data.slice(0, 4);
    offset += 4;

    const byte0 = header[0];
    const byte1 = header[1];

    const protocolVersion = (byte0 >> 4) & 0x0f;
    const headerSize = byte0 & 0x0f;
    const messageType = (byte1 >> 4) & 0x0f;
    const flags = byte1 & 0x0f;

    this.logger.debug(
      `Parsed header: version=${protocolVersion}, headerSize=${headerSize}, messageType=0x${messageType.toString(16)}, flags=0b${flags.toString(2).padStart(4, '0')}`,
    );

    let eventId: number | undefined;
    if (flags & 0x04) {
      eventId = data.readInt32BE(offset);
      offset += 4;
    }

    let sessionId: string | undefined;
    if (flags & 0x08) {
      const sessionIdSize = data.readInt32BE(offset);
      offset += 4;
      if (sessionIdSize > 0 && offset + sessionIdSize <= data.length) {
        sessionId = data.slice(offset, offset + sessionIdSize).toString('utf8');
        offset += sessionIdSize;
      }
    }

    // ERROR_INFORMATION (0x0F) 帧结构不同：在 payload 前有 4 字节错误码
    // 结构：header(4) + errorCode(4) + payloadSize(4) + payload(N)
    if (messageType === 0x0F) {
      // 跳过 4 字节错误码
      const errorCode = offset + 4 <= data.length ? data.readInt32BE(offset) : 0;
      offset += 4;

      // 确保有足够的数据读取 payloadSize
      if (offset + 4 > data.length) {
        this.logger.error('Not enough data for payloadSize in ERROR_INFORMATION');
        return { messageType, eventId, sessionId, payload: Buffer.alloc(0) };
      }

      const payloadSize = data.readInt32BE(offset);
      offset += 4;

      const safePayloadSize = Math.min(payloadSize, data.length - offset);
      const payload = data.slice(offset, offset + safePayloadSize);

      this.logger.debug(
        `Parsed ERROR_INFORMATION: errorCode=${errorCode}, payloadSize=${payloadSize}`,
      );

      return { messageType, eventId, sessionId, payload };
    }

    // 确保有足够的数据读取 payloadSize
    if (offset + 4 > data.length) {
      this.logger.error('Not enough data for payloadSize');
      return { messageType, eventId, sessionId, payload: Buffer.alloc(0) };
    }

    const payloadSize = data.readInt32BE(offset);
    offset += 4;
    
    // 确保 payloadSize 合理
    const safePayloadSize = Math.min(payloadSize, data.length - offset);
    if (safePayloadSize !== payloadSize) {
      this.logger.warn(`Payload size mismatch: expected ${payloadSize}, actual ${safePayloadSize}`);
    }
    
    const payload = data.slice(offset, offset + safePayloadSize);

    this.logger.debug(
      `Parsed frame: messageType=0x${messageType.toString(16)}, eventId=${eventId}, sessionId=${sessionId}, payloadSize=${payloadSize}, actualPayloadSize=${safePayloadSize}`,
    );

    return {
      messageType,
      eventId,
      sessionId,
      payload,
    };
  }

  /**
   * 解析 Payload 为 JSON 对象
   */
  public static parsePayloadJson<T = any>(payload: Buffer): T | null {
    try {
      // 先尝试直接解析
      const jsonStr = payload.toString('utf8');
      this.logger.debug('Parsing payload JSON:', jsonStr);
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      // 如果失败，尝试清理 BOM 和其他不可见字符
      try {
        const cleaned = payload.toString('utf8').replace(/^\uFEFF/, '').trim();
        this.logger.debug('Trying cleaned payload JSON:', cleaned);
        return JSON.parse(cleaned) as T;
      } catch (e2) {
        this.logger.error('Failed to parse payload JSON:', e2);
        this.logger.error('Raw payload:', payload.toString('hex'));
        return null;
      }
    }
  }
}

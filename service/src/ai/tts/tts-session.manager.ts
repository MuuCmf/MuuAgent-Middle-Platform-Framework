import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TtsGateway } from './tts.gateway';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as WebSocket from 'ws';

// ──────────────────────────────────────────────────
// 火山引擎 V3 双向 WS 二进制协议常量
// ──────────────────────────────────────────────────

/** 消息类型（Byte 1 高4位） */
const MT_FULL_CLIENT_REQ = 0x01;
const MT_FULL_SERVER_RES = 0x09;
const MT_AUDIO_ONLY_RES = 0x0B;
const MT_ERROR_INFO = 0x0F;

/** 特定标志（Byte 1 低4位）：包含事件号 */
const FLAG_HAS_EVENT = 0x04;
const FLAG_HAS_CONNECT_ID = 0x01;

/** 序列化方式（Byte 2 高4位） */
const SER_JSON = 0x10;
const SER_RAW = 0x00;

/** 压缩方式（Byte 2 低4位） */
const COMP_NONE = 0x00;

/** 事件号 */
const EV_START_SESSION = 100;
const EV_SESSION_STARTED = 101;
const EV_TASK_REQUEST = 102;
const EV_AUDIO_DATA = 103;
const EV_FINISH_SESSION = 104;
const EV_SESSION_FINISHED = 152;

// ──────────────────────────────────────────────────
// 二进制帧构建器
// ──────────────────────────────────────────────────

/**
 * 构建火山引擎 V3 二进制帧
 *
 * 帧结构：
 *   Byte 0: [ProtocolVersion(4bit) | HeaderSize(4bit)] = 0x11
 *   Byte 1: [MessageType(4bit) | SpecificFlags(4bit)]
 *   Byte 2: [Serialization(4bit) | Compression(4bit)]
 *   Byte 3: Reserved = 0x00
 *   Byte 4~7: EventNumber (32-bit big-endian)   ← 当 flags 包含 FLAG_HAS_EVENT
 *   Byte 8+: Payload
 *
 * @param messageType 消息类型（MT_FULL_CLIENT_REQ 等）
 * @param event 事件号
 * @param serialization 序列化方式（SER_JSON / SER_RAW）
 * @param payload 载荷（Buffer）
 * @returns 完整二进制帧
 */
function buildFrame(
  messageType: number,
  event: number,
  serialization: number,
  payload?: Buffer,
): Buffer {
  const flags = FLAG_HAS_EVENT;
  const headerSizeMultiplier = 1; // 1 × 4 = 4 字节头部
  const payloadBuf = payload || Buffer.alloc(0);

  const frame = Buffer.alloc(8 + payloadBuf.length);

  frame[0] = (0x01 << 4) | headerSizeMultiplier; // 0x11
  frame[1] = (messageType << 4) | flags;

  if (serialization === SER_JSON) {
    frame[2] = SER_JSON | COMP_NONE; // 0x10
  } else {
    frame[2] = SER_RAW | COMP_NONE; // 0x00
  }

  frame[3] = 0x00;

  // Event number (32-bit big-endian)
  frame.writeUInt32BE(event, 4);

  // Payload
  if (payloadBuf.length > 0) {
    payloadBuf.copy(frame, 8);
  }

  return frame;
}

/**
 * 构建一个 JSON 请求帧
 *
 * @param event 事件号
 * @param payloadObj JSON 对象
 * @returns 完整二进制帧
 */
function buildJsonFrame(event: number, payloadObj: object): Buffer {
  const jsonStr = JSON.stringify(payloadObj);
  const payloadBuf = Buffer.from(jsonStr, 'utf-8');
  return buildFrame(MT_FULL_CLIENT_REQ, event, SER_JSON, payloadBuf);
}

// ──────────────────────────────────────────────────
// 二进制帧解析器
// ──────────────────────────────────────────────────

interface ParsedFrame {
  /** 事件号 */
  event: number;
  /** 载荷（原始 Buffer） */
  payload: Buffer;
  /** 是否为 JSON 序列化 */
  isJson: boolean;
  /** 是否为音频纯数据帧 */
  isAudio: boolean;
  /** 是否为错误帧 */
  isError: boolean;
  /** 若非 JSON 可解析，payload 文本（用于日志） */
  payloadText?: string;
  /** JSON 解析后的对象 */
  payloadObj?: any;
}

/**
 * 尝试在缓冲区中解析一个完整的帧
 *
 * @param buf 包含二进制数据的 Buffer
 * @returns 解析结果或 null（帧不完整）
 */
function parseFrame(buf: Buffer): ParsedFrame | null {
  if (buf.length < 8) return null;

  const headerSizeMultiplier = buf[0] & 0x0F;
  const headerBytes = headerSizeMultiplier * 4;
  if (headerBytes < 8) return null;
  if (buf.length < headerBytes) return null;

  const protocolVersion = buf[0] >> 4;
  if (protocolVersion !== 1) return null;

  const msgType = buf[1] >> 4;
  const flags = buf[1] & 0x0F;
  const serialization = buf[2] >> 4;
  const hasEvent = (flags & FLAG_HAS_EVENT) !== 0;

  let offset = headerBytes;

  let event = 0;
  if (hasEvent) {
    if (buf.length < offset + 4) return null;
    event = buf.readUInt32BE(offset);
    offset += 4;
  }

  const payload = buf.subarray(offset);

  const isError = msgType === MT_ERROR_INFO;
  const isAudio = msgType === MT_AUDIO_ONLY_RES;
  const isJson = serialization === 0x01;

  let payloadObj: any = undefined;
  let payloadText: string | undefined = undefined;

  if (isJson && payload.length > 0) {
    payloadText = payload.toString('utf-8');
    try {
      payloadObj = JSON.parse(payloadText);
    } catch { /* ignore */ }
  }

  return { event, payload, isJson, isAudio, isError, payloadText, payloadObj };
}

// ──────────────────────────────────────────────────
// 会话状态
// ──────────────────────────────────────────────────

interface VolcTtsSession {
  conversationId: string;
  ws: WebSocket;
  voice: string;
  speed: number;
  seq: number;
  closed: boolean;
  activeRequest: boolean;
  pendingTexts: string[];
  receivedAudio: boolean;
  serverClosed: boolean;
  sessionEstablished: boolean;
  /** 接收缓冲区（黏包处理） */
  recvBuf: Buffer;
  /** 等待 SessionStarted 的 resolve/reject */
  sessionReadyResolve: (() => void) | null;
  sessionReadyReject: ((err: Error) => void) | null;
}

// ──────────────────────────────────────────────────
// TTS 会话管理器
// ──────────────────────────────────────────────────

@Injectable()
export class TtsSessionManager {
  private readonly logger = new Logger(TtsSessionManager.name);

  private sessions = new Map<string, VolcTtsSession>();
  private sessionOpening = new Set<string>();

  private readonly MIN_AUDIO_BYTES = 200;

  constructor(
    @Inject(forwardRef(() => TtsGateway))
    private readonly gateway: TtsGateway,
    private readonly modelRouting: ModelRoutingService,
    private readonly prisma: PrismaService,
  ) {}

  async ensureSession(conversationId: string, modelCode?: string): Promise<boolean> {
    if (this.isSessionActive(conversationId)) return true;
    if (!this.gateway.isConnected(conversationId)) return false;

    if (this.sessionOpening.has(conversationId)) {
      while (this.sessionOpening.has(conversationId)) {
        if (this.isSessionActive(conversationId)) return true;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return this.isSessionActive(conversationId);
    }

    this.sessionOpening.add(conversationId);
    try {
      await this.openSession(conversationId, modelCode);
      return true;
    } catch (error) {
      this.logger.error(`打开TTS会话失败: ${(error as Error).message}`);
      const partialSession = this.sessions.get(conversationId);
      if (partialSession && !partialSession.closed) {
        partialSession.closed = true;
        try { partialSession.ws.close(1000, 'session_failed'); } catch { /* ignore */ }
      }
      this.sessions.delete(conversationId);
      return false;
    } finally {
      this.sessionOpening.delete(conversationId);
    }
  }

  async openSession(conversationId: string, modelCode?: string): Promise<void> {
    if (this.sessions.has(conversationId)) {
      await this.closeSession(conversationId);
    }

    if (!this.gateway.isConnected(conversationId)) {
      throw new Error('客户端未连接');
    }

    const clientParams = this.gateway.getClientParams(conversationId);
    const voiceId = clientParams?.voiceId || 'zh_female_vv_uranus_bigtts';
    const voiceSpeed = clientParams?.speed || 1.0;

    const model = await this.resolveModel(modelCode, voiceId);
    const apiKey = this.resolveApiKey(model.apiKey);
    const modelCodeResolved = model.code || 'seed-tts-2.0';
    const wsEndpoint = model.endpoint || 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

    // 从 model.config 解析 APP ID（双向 WS 需要 X-Api-App-Key）
    const appId = this.resolveAppId(model.config);

    this.logger.debug(`打开TTS会话: ${conversationId}, model=${modelCodeResolved}, voice=${voiceId}, hasAppId=${!!appId}`);

    const wsHeaders: Record<string, string> = {
      'X-Api-Resource-Id': modelCodeResolved,
      'X-Api-Connect-Id': crypto.randomUUID(),
      'User-Agent': 'muu-agent-service/1.0',
    };

    if (appId) {
      wsHeaders['X-Api-App-Key'] = appId;
      wsHeaders['X-Api-Access-Key'] = apiKey;
    } else {
      wsHeaders['X-Api-Key'] = apiKey;
    }

    const ws = new WebSocket(wsEndpoint, { headers: wsHeaders });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时(10s)')), 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')); };
    });

    const session: VolcTtsSession = {
      conversationId,
      ws,
      voice: voiceId,
      speed: voiceSpeed,
      seq: 0,
      closed: false,
      activeRequest: false,
      pendingTexts: [],
      receivedAudio: false,
      serverClosed: false,
      sessionEstablished: false,
      recvBuf: Buffer.alloc(0),
      sessionReadyResolve: null,
      sessionReadyReject: null,
    };

    this.sessions.set(conversationId, session);
    this.setupWsHandlers(session);

    // 发送 StartSession（event=100）
    this.logger.debug(`发送 StartSession`);
    const startSessionPayload = {
      event: EV_START_SESSION,
      user: { uid: conversationId },
      namespace: 'BidirectionalTTS',
      req_params: this.buildSessionConfig(voiceId, voiceSpeed),
    };
    ws.send(buildJsonFrame(EV_START_SESSION, startSessionPayload));

    // 等待 SessionStarted（event=101），最多 10s
    await new Promise<void>((resolve, reject) => {
      session.sessionReadyResolve = resolve;
      session.sessionReadyReject = reject;
      const timer = setTimeout(() => {
        session.sessionReadyResolve = null;
        session.sessionReadyReject = null;
        reject(new Error('等待 SessionStarted 超时(10s)'));
      }, 10000);
      // 包装 resolve 以清除计时器
      const origResolve = resolve;
      session.sessionReadyResolve = () => {
        clearTimeout(timer);
        session.sessionReadyResolve = null;
        session.sessionReadyReject = null;
        origResolve();
      };
    });

    session.sessionEstablished = true;
    this.gateway.notifyStart(conversationId);

    this.logger.debug(`TTS 会话已打开: ${conversationId}`);
  }

  private setupWsHandlers(session: VolcTtsSession): void {
    const { ws } = session;

    ws.on('message', (raw: WebSocket.Data) => {
      if (session.closed) return;

      // WS 库可能返回 Buffer 或 ArrayBuffer
      let buf: Buffer;
      if (raw instanceof Buffer) {
        buf = raw;
      } else if (raw instanceof ArrayBuffer) {
        buf = Buffer.from(raw);
      } else if (Array.isArray(raw)) {
        // 分片帧：拼接所有 Buffer
        const chunks = raw.filter((c): c is Buffer => c instanceof Buffer || c instanceof Uint8Array);
        buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
      } else if (typeof raw === 'string') {
        buf = Buffer.from(raw, 'utf-8');
      } else {
        buf = Buffer.from(raw as any);
      }

      this.handleBinaryData(session, buf);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason ? reason.toString('utf-8') : '';
      this.logger.debug(`火山引擎 WS 关闭: code=${code}, reason="${reasonStr}"`);
      if (!session.closed) {
        session.serverClosed = true;
      }
      session.closed = true;
      session.activeRequest = false;
      if (session.sessionReadyReject) {
        const reject = session.sessionReadyReject;
        session.sessionReadyResolve = null;
        session.sessionReadyReject = null;
        reject(new Error(`火山引擎 WS 异常关闭: code=${code}, reason="${reasonStr}"`));
      }
    });

    ws.on('error', (err: Error) => {
      this.logger.error(`火山引擎 WS 错误: ${err.message}`);
      if (!session.closed) {
        session.serverClosed = true;
      }
      session.closed = true;
      session.activeRequest = false;
      if (session.sessionReadyReject) {
        const reject = session.sessionReadyReject;
        session.sessionReadyResolve = null;
        session.sessionReadyReject = null;
        reject(new Error(`火山引擎 WS 错误: ${err.message}`));
      }
    });
  }

  private handleBinaryData(session: VolcTtsSession, data: Buffer): void {
    // 黏包处理：追加到接收缓冲区
    session.recvBuf = Buffer.concat([session.recvBuf, data]);

    while (session.recvBuf.length >= 8) {
      const frame = parseFrame(session.recvBuf);
      if (!frame) break;

      // 移除已解析的帧
      const headerSize = (session.recvBuf[0] & 0x0F) * 4;
      let frameSize = headerSize;
      if (frame.event !== undefined) frameSize += 4;
      frameSize += frame.payload.length;
      const remaining = session.recvBuf.subarray(frameSize);
      session.recvBuf = Buffer.from(remaining);

      this.handleFrame(session, frame);
    }
  }

  private handleFrame(session: VolcTtsSession, frame: ParsedFrame): void {
    const { event, payload, isJson, isAudio, isError, payloadObj, payloadText } = frame;

    this.logger.debug(
      `收到帧: event=${event}, isJson=${isJson}, isAudio=${isAudio}, isError=${isError}, payloadLen=${payload.length}`,
    );

    if (isError) {
      this.logger.warn(`火山引擎 WS 错误帧: payload=${payloadText || payload.toString('hex').slice(0, 100)}`);
      if (session.sessionReadyResolve) {
        session.sessionReadyResolve();
        session.sessionReadyResolve = null;
      }
      this.handleRequestEnd(session);
      return;
    }

    // 错误码检测（JSON 中的 code 字段）
    if (payloadObj && payloadObj.code !== undefined && payloadObj.code !== 0 && payloadObj.code !== 20000000) {
      this.logger.warn(`火山引擎错误: code=${payloadObj.code}, message=${payloadObj.message || ''}`);
      this.gateway.notifyError(session.conversationId, `火山引擎错误: ${payloadObj.message || payloadObj.code}`);
      if (session.sessionReadyResolve) {
        session.sessionReadyResolve();
        session.sessionReadyResolve = null;
      }
      this.handleRequestEnd(session);
      return;
    }

    switch (event) {
      case EV_SESSION_STARTED:
        this.logger.debug(`SessionStarted 确认`);
        if (session.sessionReadyResolve) {
          const resolve = session.sessionReadyResolve;
          session.sessionReadyResolve = null;
          session.sessionReadyReject = null;
          resolve();
        }
        break;

      case EV_AUDIO_DATA:
        if (isAudio && payload.length > 0) {
          this.handleAudioPayload(session, payload);
        } else if (isJson && payloadObj && payloadObj.data) {
          this.handleAudioData(session, payloadObj.data, payloadObj.is_last === true);
        }
        break;

      case EV_SESSION_FINISHED:
        this.logger.debug(`SessionFinished`);
        session.activeRequest = false;
        break;

      default:
        if (isJson && payloadObj) {
          this.logger.debug(`未处理事件 ${event}: ${JSON.stringify(payloadObj).slice(0, 200)}`);
        }
        break;
    }
  }

  private handleAudioPayload(session: VolcTtsSession, payload: Buffer): void {
    if (payload.length < this.MIN_AUDIO_BYTES) {
      this.logger.debug(`跳过小尺寸音频帧: ${payload.length} bytes`);
      return;
    }

    session.receivedAudio = true;

    this.gateway.pushAudioChunk(
      session.conversationId,
      payload.toString('base64'),
      'mp3',
      session.seq++,
      false,
      24000,
    );
  }

  private handleAudioData(session: VolcTtsSession, base64Data: string, isLast: boolean): void {
    if (!base64Data) return;

    const bytes = Buffer.from(base64Data, 'base64').length;
    if (bytes < this.MIN_AUDIO_BYTES) {
      this.logger.debug(`跳过小尺寸 JSON 音频数据: ${bytes} bytes`);
      if (isLast) {
        session.activeRequest = false;
        this.dispatchNext(session);
      }
      return;
    }

    session.receivedAudio = true;

    this.gateway.pushAudioChunk(
      session.conversationId,
      base64Data,
      'mp3',
      session.seq++,
      isLast,
      24000,
    );

    if (isLast) {
      session.activeRequest = false;
      this.dispatchNext(session);
    }
  }

  sendText(conversationId: string, text: string): void {
    const session = this.sessions.get(conversationId);
    if (!session || session.closed) {
      this.logger.warn(`TTS 会话不存在或已关闭: ${conversationId}`);
      return;
    }

    if (session.activeRequest) {
      session.pendingTexts.push(text);
      return;
    }

    this.sendTaskRequest(session, text);
  }

  private sendTaskRequest(session: VolcTtsSession, text: string): void {
    if (session.closed) return;

    session.activeRequest = true;

    this.logger.debug(`发送 TaskRequest: "${text.slice(0, 30)}..."`);

    const payload = {
      event: EV_TASK_REQUEST,
      namespace: 'BidirectionalTTS',
      req_params: { text },
    };

    session.ws.send(buildJsonFrame(EV_TASK_REQUEST, payload));
  }

  async closeSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    this.logger.debug(`关闭TTS会话: ${conversationId}, activeRequest=${session.activeRequest}`);

    if (!session.closed) {
      this.logger.debug(`发送 FinishSession`);
      const payload = { event: EV_FINISH_SESSION, namespace: 'BidirectionalTTS' };
      session.ws.send(buildJsonFrame(EV_FINISH_SESSION, payload));
    }

    if (!session.closed && session.activeRequest) {
      const deadline = Date.now() + 10000;
      while (session.activeRequest && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!session.closed) {
      session.closed = true;
      try { session.ws.close(1000, 'session_end'); } catch { /* ignore */ }
    }

    this.sessions.delete(conversationId);

    if (session.serverClosed && !session.receivedAudio) {
      this.gateway.notifyError(conversationId, '火山引擎语音合成失败：连接已断开，未收到音频数据');
    } else if (!session.receivedAudio && session.seq === 0) {
      this.gateway.notifyError(conversationId, '语音合成失败：未收到有效音频数据');
    }

    this.gateway.notifyEnd(conversationId);
    this.logger.debug(`TTS 会话已关闭: ${conversationId}`);
  }

  isSessionActive(conversationId: string): boolean {
    const session = this.sessions.get(conversationId);
    return !!session && !session.closed && session.sessionEstablished;
  }

  private handleRequestEnd(session: VolcTtsSession): void {
    session.activeRequest = false;
    this.dispatchNext(session);
  }

  private dispatchNext(session: VolcTtsSession): void {
    if (session.pendingTexts.length > 0 && !session.closed) {
      const nextText = session.pendingTexts.shift()!;
      this.sendTaskRequest(session, nextText);
    }
  }

  private buildSessionConfig(voice: string, speed: number): any {
    const speechRate = this.convertSpeed(speed);
    return {
      speaker: voice,
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
        speech_rate: speechRate,
        loudness_rate: 0,
      },
    };
  }

  private resolveApiKey(modelApiKey?: string | null): string {
    if (modelApiKey) return modelApiKey.trim();
    return process.env.VOLCENGINE_API_KEY || '';
  }

  /**
   * 从 model.config JSON 中解析 APP ID
   *
   * 双向 WS 鉴权需要 X-Api-App-Key（APP ID）+ X-Api-Access-Key（Access Token），
   * 不同于单向 HTTP 的 X-Api-Key 鉴权。
   * APP ID 存储在 model.config 的 appId 字段中。
   *
   * @param modelConfig 模型 config JSON 字符串
   * @returns APP ID，若无则返回空
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

  private convertSpeed(speed?: number): number {
    if (speed === undefined || speed === null) return 0;
    const rate = Math.round((speed - 1) * 100);
    if (rate < -50) return -50;
    if (rate > 100) return 100;
    return rate;
  }

  private async resolveModel(modelCode?: string, voice?: string): Promise<any> {
    if (modelCode) {
      try { return await this.modelRouting.selectModelByIntent('tts', 'tts:realtime', modelCode); } catch {
        try {
          const model = await this.prisma.model.findFirst({
            where: { code: modelCode, type: 'tts', status: true },
          });
          if (model) return model;
        } catch { /* fallthrough */ }
      }
    }

    if (voice) {
      const code = await this.getVoiceModelCode(voice);
      if (code) {
        try { return await this.modelRouting.selectModelByIntent('tts', 'tts:realtime', code); } catch {
          try {
            const model = await this.prisma.model.findFirst({
              where: { code, type: 'tts', status: true },
            });
            if (model) return model;
          } catch { /* fallthrough */ }
        }
      }
    }

    const realtime = await this.findRealtimeModel();
    if (realtime) return realtime;

    return this.modelRouting.selectModel('tts');
  }

  private async getVoiceModelCode(voiceId: string): Promise<string | undefined> {
    try {
      const profile = await this.prisma.voiceProfile.findFirst({
        where: { voiceId, status: true },
        orderBy: { isDefault: 'desc' },
      });
      return profile?.modelCode || undefined;
    } catch {
      return undefined;
    }
  }

  private async findRealtimeModel(): Promise<any | null> {
    try {
      const models = await this.prisma.model.findMany({
        where: {
          type: 'tts',
          status: true,
          capabilities: { contains: 'tts:realtime' },
          provider: 'volcengine',
        },
        orderBy: { weight: 'desc' },
      });
      if (models.length > 0) return models[0];

      const fallback = await this.prisma.model.findMany({
        where: { type: 'tts', status: true, capabilities: { contains: 'tts:realtime' } },
        orderBy: { weight: 'desc' },
      });
      return fallback[0] || null;
    } catch {
      return null;
    }
  }
}

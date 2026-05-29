import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TtsGateway } from './tts.gateway';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as WebSocket from 'ws';

/**
 * 活跃的TTS会话
 *
 * 管理一个对话与阿里云DashScope TTS服务之间的WebSocket连接。
 * 使用Commit模式，客户端显式控制文本提交与合成时机。
 */
interface ActiveTtsSession {
  /** 会话ID（即conversationId） */
  conversationId: string;
  /** WebSocket连接 */
  ws: WebSocket;
  /** 语音标识 */
  voice: string;
  /** 语速 */
  speed: number;
  /** 音频块序号 */
  seq: number;
  /** 是否已关闭 */
  closed: boolean;
  /** 消息队列 */
  msgQueue: string[];
  /** 消息等待回调 */
  msgResolve: ((m: string) => void) | null;
  /** 音频消费者完成的Promise resolve */
  consumerDone: (() => void) | null;
  /** 音频消费者Promise */
  consumerPromise: Promise<void> | null;
  /** 是否已进入关闭流程 */
  finishing: boolean;
  /** 活跃response数量（收到response.created但尚未response.done） */
  activeResponses: number;
  /** 本地暂存的待合成文本（活跃response期间不直接append到DashScope） */
  pendingTexts: string[];
  /** 是否已发送commit但尚未收到response.created（时序竞争防护） */
  commitInFlight: boolean;
  /** 是否已调度延迟flush（防重复调度） */
  flushScheduled: boolean;
  /** response完成等待回调列表 */
  responseWaiters: (() => void)[];
}

/**
 * TTS会话管理器
 *
 * 管理每个对话的TTS WebSocket会话生命周期。
 * 使用Commit模式：客户端显式控制文本提交时机，
 * 确保所有文本合成完毕后再关闭会话。
 *
 * 为什么不用ServerCommit模式：
 * ServerCommit模式下DashScope不主动发response.done，
 * session.finish也不会触发排空剩余文本，导致未合成文本被丢弃。
 *
 * Commit模式的关键优势：
 * - 客户端显式commit，DashScope知道文本何时完整
 * - DashScope会正确发送response.done，可追踪合成完成
 * - 关闭时等所有response完成，确保文本全部合成
 *
 * Commit调度规则：
 * - 无活跃response时，append后立即commit到DashScope
 * - 有活跃response时，文本暂存本地pendingTexts，等response.done后再flush
 * - 这样避免DashScope忽略活跃response期间的commit
 */
@Injectable()
export class TtsSessionManager {
  private readonly logger = new Logger(TtsSessionManager.name);

  /** conversationId → ActiveTtsSession */
  private sessions = new Map<string, ActiveTtsSession>();

  /** 阿里云 Qwen-TTS 支持的音色列表 */
  private static readonly ALIYUN_QWEN_VOICES = new Set([
    'Cherry', 'Serena', 'Ethan', 'Chelsie', 'Momo', 'Vivian',
    'Moon', 'Maia', 'Kai', 'Nofish', 'Bella', 'Jennifer',
    'Dylan', 'Sunny', 'Aiden', 'Ryan', 'Soji',
  ]);

  constructor(
    @Inject(forwardRef(() => TtsGateway))
    private readonly gateway: TtsGateway,
    private readonly modelRouting: ModelRoutingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 确保TTS会话已打开
   *
   * @param conversationId 会话ID
   * @param modelCode 模型编码（可选）
   * @returns 会话是否就绪
   */
  async ensureSession(conversationId: string, modelCode?: string): Promise<boolean> {
    if (this.isSessionActive(conversationId)) return true;
    if (!this.gateway.isConnected(conversationId)) return false;

    try {
      await this.openSession(conversationId, modelCode);
      return true;
    } catch (error) {
      this.logger.error(`打开TTS会话失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 打开TTS会话
   *
   * @param conversationId 会话ID
   * @param modelCode 模型编码（可选）
   */
  async openSession(conversationId: string, modelCode?: string): Promise<void> {
    if (this.sessions.has(conversationId)) {
      await this.closeSession(conversationId);
    }

    if (!this.gateway.isConnected(conversationId)) {
      this.logger.warn(`客户端未连接，跳过TTS会话打开: ${conversationId}`);
      return;
    }

    const model = await this.resolveModel(modelCode);
    const provider = model.provider || '';

    if (provider === 'volcengine') {
      throw new Error('火山引擎 seed-tts 模型不支持会话模式，请使用非会话合成');
    }

    const apiKey = model.apiKey || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('DashScope API Key 未配置');
    }

    const clientParams = this.gateway.getClientParams(conversationId);
    const voiceId = this.resolveVoice(clientParams?.voiceId || 'Cherry');
    const voiceSpeed = clientParams?.speed || 1.0;
    const modelCodeResolved = model.code || 'qwen3-tts-flash-realtime';

    this.logger.debug(`打开TTS会话: ${conversationId}, model=${modelCodeResolved}, voice=${voiceId}, speed=${voiceSpeed}`);

    const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${modelCodeResolved}`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'muu-agent-service/1.0',
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时(10s)')), 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')); };
    });

    const session: ActiveTtsSession = {
      conversationId,
      ws,
      voice: voiceId,
      speed: voiceSpeed,
      seq: 0,
      closed: false,
      msgQueue: [],
      msgResolve: null,
      consumerDone: null,
      consumerPromise: null,
      finishing: false,
      activeResponses: 0,
      pendingTexts: [],
      commitInFlight: false,
      flushScheduled: false,
      responseWaiters: [],
    };

    ws.on('message', (raw: WebSocket.Data) => {
      if (session.closed) return;
      const m = typeof raw === 'string' ? raw : raw.toString();
      if (session.msgResolve) {
        const r = session.msgResolve;
        session.msgResolve = null;
        r(m);
      } else {
        session.msgQueue.push(m);
      }
    });

    ws.on('close', () => {
      session.closed = true;
      session.commitInFlight = false;
      this.notifyResponseWaiters(session);
      if (session.msgResolve) {
        const r = session.msgResolve;
        session.msgResolve = null;
        r('');
      }
    });

    ws.on('error', () => {
      session.closed = true;
      session.commitInFlight = false;
      this.notifyResponseWaiters(session);
      if (session.msgResolve) {
        const r = session.msgResolve;
        session.msgResolve = null;
        r('');
      }
    });

    this.sessions.set(conversationId, session);

    try {
      const first = await this.nextMessage(session, 15000);
      if (first === 'TIMEOUT' || !first) throw new Error('未收到 session.created');

      this.send(session, {
        event_id: crypto.randomUUID(),
        type: 'session.update',
        session: {
          voice: voiceId,
          mode: 'commit',
          response_format: 'pcm',
          sample_rate: 24000,
          language_type: 'Chinese',
        },
      });

      let updated = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const m = await this.nextMessage(session, Math.min(deadline - Date.now(), 2000));
        if (m === 'TIMEOUT' || !m) break;
        try {
          const d = JSON.parse(m);
          if (d.type === 'session.updated') { updated = true; break; }
          if (d.type === 'error' || d.type === 'response.error') {
            throw new Error(`session.update 错误: ${d.error?.message || m.slice(0, 200)}`);
          }
        } catch (e) {
          if ((e as Error).message?.startsWith('session.update')) throw e;
        }
      }
      if (!updated) this.logger.warn('未收到 session.updated 确认，继续');

      this.gateway.notifyStart(conversationId);

      this.startAudioConsumer(session);

      this.logger.debug(`TTS 会话已打开: ${conversationId}`);
    } catch (error) {
      session.closed = true;
      try { ws.close(); } catch { /* ignore */ }
      this.sessions.delete(conversationId);
      throw error;
    }
  }

  /**
   * 追加文本到合成缓冲区并调度commit
   *
   * Commit模式下，append后需要显式commit触发合成。
   * 调度规则：
   * - 无活跃response且无飞行中commit时，立即append+commit到DashScope
   * - 有活跃response或飞行中commit时，将文本暂存到本地pendingTexts队列，
   *   等response完成后再一次性flush到DashScope。
   *   这是因为DashScope在活跃response期间会忽略input_text_buffer.append。
   *
   * @param conversationId 会话ID
   * @param text 要合成的文本
   */
  sendText(conversationId: string, text: string): void {
    const session = this.sessions.get(conversationId);
    if (!session || session.closed) {
      this.logger.warn(`TTS 会话不存在或已关闭: ${conversationId}`);
      return;
    }

    this.logger.debug(`TTS append文本: "${text.slice(0, 30)}..."`);

    if (session.activeResponses > 0 || session.commitInFlight || session.flushScheduled) {
      session.pendingTexts.push(text);
      this.logger.debug(
        `文本暂存本地: activeResponses=${session.activeResponses}, commitInFlight=${session.commitInFlight}, pendingCount=${session.pendingTexts.length}`,
      );
      return;
    }

    this.send(session, {
      event_id: crypto.randomUUID(),
      type: 'input_text_buffer.append',
      text,
    });

    session.commitInFlight = true;
    this.logger.debug(`发送 input_text_buffer.commit`);
    this.send(session, {
      event_id: crypto.randomUUID(),
      type: 'input_text_buffer.commit',
    });
  }

  /**
   * flush本地暂存的待合成文本到DashScope
   *
   * 当response完成（activeResponses降为0）时调用，
   * 将pendingTexts中的文本合并为单次append+commit发送。
   *
   * 关键：使用setTimeout(100ms)延迟实际WebSocket发送。
   * 这是因为DashScope在发送response.done后需要短暂内部清理，
   * 若立即收到新的input_text_buffer.append，会被当作上一response
   * 的残留输入而忽略——导致commit时缓冲区为空、response无音频。
   * 宏任务延迟确保DashScope完全退出前一个response状态。
   *
   * @param session TTS会话
   */
  private flushPendingTexts(session: ActiveTtsSession): void {
    if (session.pendingTexts.length === 0) return;
    if (session.flushScheduled) return;

    session.flushScheduled = true;

    setTimeout(() => {
      session.flushScheduled = false;
      if (session.closed) return;
      if (session.pendingTexts.length === 0) return;
      if (session.activeResponses > 0 || session.commitInFlight) return;

      const text = session.pendingTexts.join('');
      session.pendingTexts = [];

      this.logger.debug(`flushPendingTexts: "${text.slice(0, 30)}..." (${text.length}字符)`);

      this.send(session, {
        event_id: crypto.randomUUID(),
        type: 'input_text_buffer.append',
        text,
      });

      session.commitInFlight = true;
      this.logger.debug(`发送 input_text_buffer.commit`);
      this.send(session, {
        event_id: crypto.randomUUID(),
        type: 'input_text_buffer.commit',
      });
    }, 100);
  }

  /**
   * 关闭TTS会话
   *
   * Commit模式下的关闭流程：
   * 1. 循环：如果有待提交文本或飞行中的commit，等待其完成
   * 2. 等待所有活跃response完成（activeResponses === 0）
   * 3. 发送session.finish通知DashScope结束
   * 4. 等待消费者处理完剩余音频（session.finished）
   * 5. 关闭WebSocket连接
   *
   * @param conversationId 会话ID
   */
  async closeSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    this.logger.debug(`关闭TTS会话: ${conversationId}, activeResponses=${session.activeResponses}, pendingTexts=${session.pendingTexts.length}, commitInFlight=${session.commitInFlight}`);

    if (!session.closed) {
      session.finishing = true;

      const drainStart = Date.now();
      const drainDeadline = drainStart + 30000;

      while (Date.now() < drainDeadline) {
        if (session.pendingTexts.length > 0 && session.activeResponses <= 0 && !session.commitInFlight) {
          this.flushPendingTexts(session);
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        if (session.commitInFlight) {
          await this.waitForCommitInFlight(session);
        }

        if (session.activeResponses > 0) {
          await this.waitForResponses(session);
        }

        if (session.pendingTexts.length === 0 && !session.commitInFlight && session.activeResponses <= 0) {
          break;
        }
      }

      const elapsed = Date.now() - drainStart;
      if (elapsed >= 30000) {
        this.logger.warn(
          `关闭TTS会话排空超时(30s): pendingTexts=${session.pendingTexts.length}, commitInFlight=${session.commitInFlight}, activeResponses=${session.activeResponses}`,
        );
      }

      if (session.pendingTexts.length > 0) {
        this.logger.warn(`pendingTexts仍有${session.pendingTexts.length}条，强制commit剩余文本`);
        session.commitInFlight = true;
        this.send(session, {
          event_id: crypto.randomUUID(),
          type: 'input_text_buffer.commit',
        });
        await this.waitForCommitInFlight(session);
      }

      this.send(session, {
        event_id: crypto.randomUUID(),
        type: 'session.finish',
      });
    }

    if (session.consumerPromise) {
      const timeout = new Promise<void>(resolve => setTimeout(resolve, 15000));
      await Promise.race([session.consumerPromise, timeout]);
    }

    if (!session.closed) {
      session.closed = true;
      try { session.ws.close(); } catch { /* ignore */ }
    }

    this.sessions.delete(conversationId);

    this.gateway.notifyEnd(conversationId);

    this.logger.debug(`TTS 会话已关闭: ${conversationId}`);
  }

  /**
   * 判断会话是否活跃
   * @param conversationId 会话ID
   * @returns 是否活跃
   */
  isSessionActive(conversationId: string): boolean {
    const session = this.sessions.get(conversationId);
    return !!session && !session.closed;
  }

  /**
   * 等待commitInFlight变为false
   *
   * 当commit已发送但response.created尚未到达时，需要等待。
   * 这防止了closeSession在response.created到达之前就认为没有活跃response
   * 而直接发送session.finish的时序竞争问题。
   *
   * @param session TTS会话
   */
  private waitForCommitInFlight(session: ActiveTtsSession): Promise<void> {
    if (!session.commitInFlight) return Promise.resolve();

    this.logger.debug(`等待commitInFlight（等待response.created到达）...`);

    return new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.logger.warn(`等待commitInFlight超时(10s)`);
        session.responseWaiters = session.responseWaiters.filter(w => w !== onCreated);
        resolve();
      }, 10000);

      const onCreated = () => {
        if (!session.commitInFlight) {
          clearTimeout(timer);
          session.responseWaiters = session.responseWaiters.filter(w => w !== onCreated);
          resolve();
        }
      };

      session.responseWaiters.push(onCreated);
    });
  }

  /**
   * 等待所有活跃response完成
   *
   * @param session TTS会话
   */
  private waitForResponses(session: ActiveTtsSession): Promise<void> {
    if (session.activeResponses <= 0) return Promise.resolve();

    this.logger.debug(`等待 ${session.activeResponses} 个活跃response完成...`);

    return new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.logger.warn(`等待response完成超时(15s)，剩余activeResponses=${session.activeResponses}`);
        session.responseWaiters = session.responseWaiters.filter(w => w !== onDone);
        resolve();
      }, 15000);

      const onDone = () => {
        if (session.activeResponses <= 0) {
          clearTimeout(timer);
          session.responseWaiters = session.responseWaiters.filter(w => w !== onDone);
          resolve();
        }
      };

      session.responseWaiters.push(onDone);
    });
  }

  /**
   * 通知response等待回调
   *
   * @param session TTS会话
   */
  private notifyResponseWaiters(session: ActiveTtsSession): void {
    if (session.activeResponses <= 0 || session.closed || !session.commitInFlight) {
      const waiters = session.responseWaiters;
      session.responseWaiters = [];
      waiters.forEach(w => w());
    }
  }

  /**
   * 启动音频消费者
   *
   * 持续从WebSocket读取消息并处理音频数据，推送到TtsGateway。
   * 追踪response.created/response.done以管理commit调度。
   * 收到session.finished后处理完剩余音频并退出。
   *
   * @param session TTS会话
   */
  private startAudioConsumer(session: ActiveTtsSession): void {
    let consumerResolve: (() => void) | null = null;
    session.consumerPromise = new Promise<void>(resolve => { consumerResolve = resolve; });
    session.consumerDone = consumerResolve;

    const consume = async () => {
      let audioBuf = Buffer.alloc(0);
      const CHUNK = 16384;
      /** 当前response已收到的音频delta计数 */
      let audioDeltaCount = 0;

      /**
       * 刷新音频缓冲区中残留的PCM数据
       * @param isLast 是否为最后一块
       */
      const flushAudio = (isLast: boolean) => {
        if (audioBuf.length > 0) {
          this.gateway.pushAudioChunk(
            session.conversationId,
            audioBuf.toString('base64'),
            'pcm',
            session.seq++,
            isLast,
            24000,
          );
          audioBuf = Buffer.alloc(0);
        }
      };

      /**
       * response完成后的公共处理
       * 递减活跃response计数，延迟flush本地暂存文本
       *
       * 延迟由flushPendingTexts内部setTimeout实现，
       * 避免在response.done处理期间同步发送下一个commit。
       *
       * @param session TTS会话
       */
      const onResponseComplete = () => {
        session.activeResponses = Math.max(0, session.activeResponses - 1);
        this.logger.debug(`response完成, activeResponses=${session.activeResponses}`);

        if (session.activeResponses === 0 && session.pendingTexts.length > 0) {
          this.flushPendingTexts(session);
        }

        this.notifyResponseWaiters(session);
      };

      /**
       * 处理单条消息
       * @param m 消息字符串
       * @returns 是否应退出消费循环
       */
      const handleMessage = (m: string): boolean => {
        let d: any;
        try { d = JSON.parse(m); } catch { return false; }

        if (d.type === 'response.created') {
          session.activeResponses++;
          session.commitInFlight = false;
          audioDeltaCount = 0;
          this.notifyResponseWaiters(session);
          this.logger.debug(`response.created, activeResponses=${session.activeResponses}`);
        } else if (d.type === 'response.audio.delta' && d.delta) {
          audioDeltaCount++;
          audioBuf = Buffer.concat([audioBuf, Buffer.from(d.delta, 'base64')]);
          while (audioBuf.length >= CHUNK) {
            this.gateway.pushAudioChunk(
              session.conversationId,
              audioBuf.subarray(0, CHUNK).toString('base64'),
              'pcm',
              session.seq++,
              false,
              24000,
            );
            audioBuf = audioBuf.subarray(CHUNK);
          }
          if (audioDeltaCount % 20 === 0) {
            this.logger.debug(`audio.delta #${audioDeltaCount}, buf=${audioBuf.length}B`);
          }
        } else if (d.type === 'response.audio.done') {
          this.logger.debug(`audio.done, totalDeltas=${audioDeltaCount}, residual=${audioBuf.length}B`);
          flushAudio(false);
        } else if (d.type === 'response.done') {
          this.logger.debug(`response.done, totalDeltas=${audioDeltaCount}`);
          flushAudio(false);
          onResponseComplete();
        } else if (d.type === 'response.output_item.done') {
          flushAudio(false);
        } else if (d.type === 'input_text_buffer.committed') {
          this.logger.debug(`input_text_buffer.committed`);
        } else if (d.type === 'session.finished') {
          flushAudio(true);
          this.logger.debug(`收到 session.finished，消费者准备退出`);
          return true;
        } else if (d.type === 'error' || d.type === 'response.error') {
          const msg = d.error?.message || m.slice(0, 200);
          this.logger.warn(`TTS 错误: ${msg}`);
          session.commitInFlight = false;
          session.activeResponses = Math.max(0, session.activeResponses - 1);
          if (session.activeResponses === 0 && session.pendingTexts.length > 0) {
            this.flushPendingTexts(session);
          }
          this.notifyResponseWaiters(session);
        } else if (d.type) {
          this.logger.debug(`DashScope 未处理消息类型: ${d.type}`);
        }

        return false;
      };

      while (!session.closed) {
        const m = await this.nextMessage(session, 15000);
        if (m === 'TIMEOUT') {
          if (session.closed) break;
          continue;
        }
        if (!m) break;
        if (handleMessage(m)) break;
      }

      for (const m of session.msgQueue) {
        if (handleMessage(m)) break;
      }
      session.msgQueue = [];

      flushAudio(true);

      session.consumerDone?.();
    };

    consume().catch(err => {
      this.logger.error(`音频消费者异常: ${(err as Error).message}`);
      session.consumerDone?.();
    });
  }

  /**
   * 等待下一条WebSocket消息
   *
   * @param session TTS会话
   * @param ms 超时毫秒数
   * @returns 消息内容或'TIMEOUT'
   */
  private nextMessage(session: ActiveTtsSession, ms: number): Promise<string | 'TIMEOUT'> {
    if (session.msgQueue.length > 0) return Promise.resolve(session.msgQueue.shift()!);
    return new Promise<string | 'TIMEOUT'>(resolve => {
      session.msgResolve = resolve;
      setTimeout(() => {
        if (session.msgResolve) {
          session.msgResolve = null;
          resolve('TIMEOUT');
        }
      }, ms);
    });
  }

  /**
   * 发送JSON消息到WebSocket
   *
   * @param session TTS会话
   * @param obj 消息对象
   */
  private send(session: ActiveTtsSession, obj: object): void {
    if (session.closed) return;
    session.ws.send(JSON.stringify(obj));
  }

  /**
   * 解析语音标识
   *
   * @param voice 语音标识
   * @returns 阿里云兼容的语音标识
   */
  private resolveVoice(voice?: string): string {
    const defaultVoice = 'Cherry';
    if (!voice) return defaultVoice;
    if (TtsSessionManager.ALIYUN_QWEN_VOICES.has(voice)) return voice;
    this.logger.warn(`阿里云 Qwen-TTS 不支持语音 "${voice}"，自动切换为默认语音 "${defaultVoice}"`);
    return defaultVoice;
  }

  /**
   * 解析模型：指定编码 > 默认实时TTS模型 > 通用TTS模型
   *
   * @param modelCode 模型编码
   * @returns 模型信息
   */
  private async resolveModel(modelCode?: string): Promise<any> {
    if (modelCode) {
      try { return await this.modelRouting.selectModelByIntent('tts', 'tts:realtime', modelCode); } catch { /* fallthrough */ }
    }

    const realtime = await this.findRealtimeModel();
    if (realtime) return realtime;

    return this.modelRouting.selectModel('tts');
  }

  /**
   * 查找默认实时TTS模型（排除非DashScope协议的模型）
   * @returns 模型信息或null
   */
  private async findRealtimeModel(): Promise<any | null> {
    try {
      const models = await this.prisma.model.findMany({
        where: {
          type: 'tts',
          status: true,
          capabilities: { contains: 'tts:realtime' },
          provider: { not: 'volcengine' },
        },
        orderBy: { weight: 'desc' },
      });
      return models[0] || null;
    } catch {
      return null;
    }
  }
}

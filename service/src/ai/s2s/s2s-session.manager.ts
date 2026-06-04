import { Injectable, Logger, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { S2sGateway } from './s2s.gateway';
import { StrategyFactory } from '../strategies/strategy.factory';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { S2SExecutionParams } from '../strategies/provider.strategy.interface';
import { VolcengineS2SClient } from './volcengine-s2s.client';

/**
 * S2S 会话状态
 */
interface S2sSession {
  /** 会话ID */
  conversationId: string;
  /** 音频缓冲区（Base64 chunks） */
  audioBuffer: string[];
  /** 缓冲区大小（字节） */
  bufferSize: number;
  /** 是否正在处理 */
  processing: boolean;
  /** 是否已关闭 */
  closed: boolean;
  /** 音色 */
  voice: string;
  /** 模型编码 */
  modelCode?: string;
  /** 序号 */
  seq: number;
  /** 最后接收时间 */
  lastReceiveTime: number;
  /** WebSocket 客户端实例（火山引擎） */
  wsClient?: VolcengineS2SClient;
}

/**
 * S2S 会话管理器
 *
 * 职责：
 * - 接收客户端音频块并缓存
 * - 使用火山引擎 WebSocket 客户端进行实时双向音频流交互
 * - 将返回的音频流推送给客户端
 * - 管理会话生命周期
 *
 * 注意：火山引擎 S2S 使用 WebSocket 协议进行实时双向音频流交互。
 * 本管理器通过 WebSocket 客户端实现真正的实时体验。
 */
@Injectable()
export class S2sSessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(S2sSessionManager.name);

  /** 会话映射 */
  private sessions = new Map<string, S2sSession>();

  /** 缓冲区阈值（字节），达到此大小触发 WebSocket 发送 */
  private readonly BUFFER_THRESHOLD = 32000; // ~32KB（约1秒 Opus 音频）

  /** 最大缓冲区大小（字节），超过则丢弃旧数据 */
  private readonly MAX_BUFFER_SIZE = 128000; // ~128KB（约4秒）

  /** 处理超时（毫秒） */
  private readonly PROCESSING_TIMEOUT = 15000;

  constructor(
    @Inject(forwardRef(() => S2sGateway))
    private readonly gateway: S2sGateway,
    private readonly strategyFactory: StrategyFactory,
    private readonly modelRouting: ModelRoutingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 模块初始化
   */
  onModuleInit() {
    this.logger.debug('S2S Session Manager 已初始化');
  }

  /**
   * 模块销毁
   */
  onModuleDestroy() {
    // 关闭所有活跃会话
    for (const [conversationId] of this.sessions) {
      this.closeSession(conversationId).catch((error) => {
        this.logger.error(`关闭会话失败: ${conversationId}, error=${(error as Error).message}`);
      });
    }
  }

  /**
   * 确保会话已打开
   *
   * 创建会话并建立火山引擎 WebSocket 连接。
   *
   * @param conversationId 会话ID
   * @param modelCode 模型编码（可选）
   * @returns 是否成功
   */
  async ensureSession(conversationId: string, modelCode?: string): Promise<boolean> {
    if (this.isSessionActive(conversationId)) return true;
    if (!this.gateway.isConnected(conversationId)) return false;

    const clientParams = this.gateway.getClientParams(conversationId);
    const voiceRaw = clientParams?.voiceId || 'zh_female_vv_jupiter_bigtts';
    // S2S 对话模型使用 jupiter 系列音色，修正客户端可能传入的 uranus 等不兼容音色
    const voice = voiceRaw.replace('uranus', 'jupiter');

    const session: S2sSession = {
      conversationId,
      audioBuffer: [],
      bufferSize: 0,
      processing: false,
      closed: false,
      voice,
      modelCode: modelCode || clientParams?.modelCode,
      seq: 0,
      lastReceiveTime: Date.now(),
    };

    this.sessions.set(conversationId, session);

    try {
      // 获取模型配置（API Key）
      const model = await this.resolveModel(session.modelCode);
      const apiKey = model.apiKey || '';
      
      this.logger.debug(`Model: ${JSON.stringify({
        code: model.code,
        apiKey: apiKey ? '***' : 'empty',
        config: model.config || 'none',
      })}`);
      
      // 从模型 config 中解析 appId 和 resourceId（如果有）
      let appKey = '';
      let token = apiKey;
      let resourceId = 'volc.speech.dialog'; // S2S O 版本默认资源 ID
      if (model.config) {
        try {
          const config = JSON.parse(model.config);
          if (config.resourceId) {
            resourceId = config.resourceId;
          }
          if (config.appId) {
            appKey = config.appId;
            // 如果有 appId，并且 apiKey 包含冒号，则拆分
            if (apiKey.includes(':')) {
              const parts = apiKey.split(':');
              appKey = parts[0];
              token = parts.slice(1).join(':');
            }
          }
        } catch {
          // 如果 config 解析失败，尝试从 apiKey 中拆分 appKey:token
          if (apiKey.includes(':')) {
            const parts = apiKey.split(':');
            appKey = parts[0];
            token = parts.slice(1).join(':');
          }
        }
      } else {
        // 如果没有 config，尝试从 apiKey 中拆分 appKey:token
        if (apiKey.includes(':')) {
          const parts = apiKey.split(':');
          appKey = parts[0];
          token = parts.slice(1).join(':');
        }
      }

      this.logger.debug(`Auth params: appKey=${appKey ? '***' : 'none'}, token=${token ? '***' : 'none'}, resourceId=${resourceId}`);

      if (!token) {
        throw new Error('API Key 未配置');
      }

      // 创建 WebSocket 客户端实例
      const wsClient = new VolcengineS2SClient(token, appKey, resourceId);
      session.wsClient = wsClient;

      // 监听 WebSocket 事件
      this.setupWebSocketListeners(wsClient, session);

      // 建立 WebSocket 连接
      this.logger.log('Connecting to Volcengine...');
      await wsClient.connect();

      // 开始会话
      this.logger.log('Starting session...');
      await wsClient.startSession({ voice });

      this.gateway.notifyStart(conversationId);
      this.logger.debug(`S2S 会话已打开: ${conversationId}`);

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`S2S 会话创建失败: ${conversationId}, error=${err.message}`);
      this.sessions.delete(conversationId);
      this.gateway.notifyError(conversationId, `会话创建失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 打开会话（别名方法）
   * @param conversationId 会话ID
   * @param modelCode 模型编码（可选）
   * @returns 是否成功
   */
  async openSession(conversationId: string, modelCode?: string): Promise<boolean> {
    return this.ensureSession(conversationId, modelCode);
  }

  /**
   * 设置 WebSocket 事件监听
   *
   * @param wsClient WebSocket 客户端
   * @param session 会话对象
   */
  private setupWebSocketListeners(wsClient: VolcengineS2SClient, session: S2sSession): void {
    // 监听音频响应事件
    wsClient.on('audio', (audioData: { audioData: Buffer; isLast: boolean; format?: string }) => {
      if (session.closed) return;

      this.logger.log(`✅ 收到音频响应: ${session.conversationId}, size=${audioData.audioData.length}, isLast=${audioData.isLast}, format=${audioData.format || 'pcm'}`);

      // 推送音频块到客户端
      const success = this.gateway.pushAudioChunk(
        session.conversationId,
        audioData.audioData.toString('base64'),
        audioData.format || 'pcm',
        session.seq++,
        audioData.isLast,
      );

      if (success) {
        this.logger.debug(`✅ 音频已推送到客户端: ${session.conversationId}`);
      } else {
        this.logger.warn(`❌ 音频推送失败（客户端已断开）: ${session.conversationId}`);
      }
    });

    // 监听 ASR 事件（ASR_RESPONSE payload 是 requestId UUID，不含识别文本）
    wsClient.on('asrResponse', (requestId: string) => {
      this.logger.debug(`ASR Response requestId: ${requestId}`);
    });

    // 监听错误事件
    wsClient.on('error', (error: Error) => {
      this.logger.error(`WebSocket 错误: ${session.conversationId}, error=${error.message}`);
      this.gateway.notifyError(session.conversationId, `语音对话错误: ${error.message}`);
    });

    // 监听断开连接事件
    wsClient.on('close', (data: { code: number; reason: string }) => {
      this.logger.warn(`WebSocket 断开: ${session.conversationId}, code=${data.code}, reason=${data.reason}`);
      if (!session.closed) {
        this.gateway.notifyError(session.conversationId, '语音对话连接断开');
      }
    });

    // 监听会话结束事件
    wsClient.on('sessionFinished', () => {
      this.logger.debug(`会话结束: ${session.conversationId}`);
      if (!session.closed) {
        this.closeSession(session.conversationId).catch((e) =>
          this.logger.warn(`会话结束后清理失败: ${e.message}`),
        );
      }
    });
  }

  /**
   * 发送音频块
   *
   * 将音频块发送到火山引擎 WebSocket。
   *
   * @param conversationId 会话ID
   * @param audioData Base64 音频数据
   * @param format 音频格式
   * @param sequence 序号
   * @param isLast 是否最后一块
   */
  sendAudioChunk(
    conversationId: string,
    audioData: string,
    format: string,
    sequence: number,
    isLast: boolean,
  ): void {
    const session = this.sessions.get(conversationId);
    if (!session || session.closed) {
      this.logger.warn(`S2S 会话不存在或已关闭: ${conversationId}`);
      return;
    }

    // 检查 WebSocket 连接状态
    if (!session.wsClient) {
      this.logger.warn(`WebSocket 未连接: ${conversationId}`);
      return;
    }

    this.logger.debug(`发送音频到 WebSocket: ${conversationId}, seq=${sequence}, isLast=${isLast}`);

    // 注意：火山引擎要求 PCM 16000Hz 格式，客户端发送的是 Base64
    // TODO: 需要实现格式转换（Opus → PCM）
    const pcmData = Buffer.from(audioData, 'base64');
    session.wsClient.sendAudio(pcmData);

    session.lastReceiveTime = Date.now();
  }

  /**
   * 停止用户输入（仅发 FinishSession，不断开 WS，等待 TTS 音频全部到达）
   *
   * @param conversationId 会话ID
   */
  async finishInput(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session || session.closed) return;

    this.logger.debug(`S2S 停止输入: ${conversationId}`);

    if (session.wsClient) {
      try {
        session.wsClient.finishSession();
      } catch (error) {
        this.logger.warn(
          `发送 FinishSession 失败: ${conversationId}, error=${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * 关闭会话
   *
   * 关闭 WebSocket 连接并清理会话。
   *
   * @param conversationId 会话ID
   */
  async closeSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    this.logger.debug(`关闭 S2S 会话: ${conversationId}`);

    // 关闭 WebSocket 连接
    if (session.wsClient) {
      try {
        session.wsClient.finishSession();
        session.wsClient.disconnect();
      } catch (error) {
        this.logger.warn(
          `关闭 WebSocket 失败: ${conversationId}, error=${(error as Error).message}`,
        );
      }
    }

    session.closed = true;
    this.sessions.delete(conversationId);
    this.gateway.notifyEnd(conversationId);
    this.logger.debug(`S2S 会话已关闭: ${conversationId}`);
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
   * 解析模型
   * @param modelCode 模型编码（可选）
   * @returns 模型信息
   */
  private async resolveModel(modelCode?: string): Promise<any> {
    if (modelCode) {
      try {
        return await this.modelRouting.selectModelByIntent('s2s', 's2s:realtime', modelCode);
      } catch {
        // 从 DB 直接查找
        const model = await this.prisma.model.findFirst({
          where: { code: modelCode, type: 's2s', status: true },
        });
        if (model) return model;
      }
    }

    // 查找默认 S2S 模型
    const realtime = await this.findRealtimeModel();
    if (realtime) return realtime;

    // 使用模型路由选择
    return this.modelRouting.selectModel('s2s');
  }

  /**
   * 查找默认实时 S2S 模型
   * @returns 模型信息或null
   */
  private async findRealtimeModel(): Promise<any | null> {
    try {
      const models = await this.prisma.model.findMany({
        where: { type: 's2s', status: true, capabilities: { contains: 's2s:realtime' } },
        orderBy: { weight: 'desc' },
      });
      return models[0] || null;
    } catch {
      return null;
    }
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { S2sSessionManager } from './s2s-session.manager';

/**
 * S2S WebSocket 网关
 *
 * 职责：客户端连接管理 + 双向音频流推送，不做业务逻辑。
 * 客户端断开时自动关闭对应的S2S会话。
 *
 * 事件：
 *   client → server: audio_chunk (客户端发送音频块)
 *   server → client: audio_chunk (服务端返回合成音频)
 *   server → client: speech_text (附带识别文本)
 *   server → client: s2s_error (错误通知)
 */
@WebSocketGateway({ namespace: '/s2s', cors: { origin: '*', credentials: true } })
export class S2sGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(S2sGateway.name);

  /** conversationId → Socket */
  private clients = new Map<string, Socket>();

  constructor(
    @Inject(forwardRef(() => S2sSessionManager))
    private readonly sessionManager: S2sSessionManager,
  ) {}

  /**
   * 客户端连接
   * @param client Socket连接
   */
  async handleConnection(client: Socket): Promise<void> {
    const conversationId = client.handshake.query.conversationId as string;
    if (!conversationId) {
      client.emit('s2s_error', { message: '缺少 conversationId' });
      client.disconnect();
      return;
    }

    const old = this.clients.get(conversationId);
    if (old && old.id !== client.id) {
      old.disconnect();
    }

    this.clients.set(conversationId, client);
    this.logger.debug(`S2S 客户端连接: ${conversationId}`);
    // 火山引擎 WS 连接延迟到客户端发送第一个 audio_chunk 时创建
  }

  /**
   * 客户端发送音频块
   * @param client Socket连接
   * @param data 音频数据
   */
  @SubscribeMessage('audio_chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { data: string; format: string; sequence: number; isLast: boolean },
  ): Promise<void> {
    const conversationId = this.getConversationId(client);
    if (!conversationId) return;

    // 首次收到音频块时延迟创建火山引擎 WS 会话
    if (data.sequence === 0 && !this.sessionManager.isSessionActive(conversationId)) {
      this.logger.debug(`S2S 首次音频块，延迟创建会话: ${conversationId}`);
      try {
        const success = await this.sessionManager.openSession(conversationId);
        if (!success) {
          this.logger.error(`S2S 会话创建失败: ${conversationId}`);
          client.emit('s2s_error', { message: '会话创建失败' });
          return;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(`S2S 会话创建失败: ${err.message}`);
        client.emit('s2s_error', { message: `会话创建失败: ${err.message}` });
        return;
      }
    }

    this.logger.debug(
      `S2S 接收音频块: ${conversationId}, seq=${data.sequence}, format=${data.format}, isLast=${data.isLast}`,
    );

    this.sessionManager.sendAudioChunk(conversationId, data.data, data.format, data.sequence, data.isLast);
  }

  /**
   * 客户端切换语音
   * @param client Socket连接
   * @param data 包含voiceId的数据
   */
  @SubscribeMessage('change_voice')
  handleChangeVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceId: string },
  ): void {
    const conversationId = this.getConversationId(client);
    if (!conversationId) return;
    (client.handshake.query as any).voiceId = data.voiceId;
    this.logger.debug(`S2S 切换语音: ${conversationId} → ${data.voiceId}`);
  }

  /**
   * 客户端切换S2S模型
   * @param client Socket连接
   * @param data 包含modelCode的数据
   */
  @SubscribeMessage('change_model')
  handleChangeModel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { modelCode: string },
  ): void {
    const conversationId = this.getConversationId(client);
    if (!conversationId) return;
    (client.handshake.query as any).modelCode = data.modelCode;
    this.logger.debug(`S2S 切换模型: ${conversationId} → ${data.modelCode}`);
  }

  /**
   * 客户端停止对话
   * @param client Socket连接
   */
  @SubscribeMessage('stop')
  handleStop(@ConnectedSocket() client: Socket): void {
    const conversationId = this.getConversationId(client);
    if (!conversationId) return;
    this.logger.debug(`S2S 停止录音: ${conversationId}`);
    // 连续对话模式：停止录音由客户端控制，服务端不做任何操作
    // 火山引擎 VAD 自动检测语音结束，无需发送 FinishSession
  }

  /**
   * 从Socket获取conversationId
   * @param client Socket连接
   * @returns conversationId或null
   */
  private getConversationId(client: Socket): string | null {
    return (client.handshake.query.conversationId as string) || null;
  }

  /**
   * 客户端断开
   *
   * 自动关闭对应的S2S会话，释放WebSocket连接资源。
   *
   * @param client Socket连接
   */
  handleDisconnect(client: Socket): void {
    for (const [convId, socket] of this.clients) {
      if (socket.id === client.id) {
        this.clients.delete(convId);
        this.sessionManager.closeSession(convId).catch((e: Error) => {
          this.logger.warn(`客户端断开时关闭S2S会话失败: ${e.message}`);
        });
        break;
      }
    }
  }

  /**
   * 推送音频块到客户端
   * @param conversationId 会话ID
   * @param data 音频数据（Base64）
   * @param format 格式
   * @param sequence 序号
   * @param isLast 是否最后一块
   * @returns 是否推送成功
   */
  pushAudioChunk(
    conversationId: string,
    data: string,
    format: string,
    sequence: number,
    isLast: boolean,
  ): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('audio_chunk', { data, format, sequence, isLast });
    return true;
  }

  /**
   * 推送识别文本到客户端
   * @param conversationId 会话ID
   * @param text 识别文本
   * @returns 是否推送成功
   */
  pushSpeechText(conversationId: string, text: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('speech_text', { text });
    return true;
  }

  /**
   * 通知对话开始
   * @param conversationId 会话ID
   * @returns 是否成功
   */
  notifyStart(conversationId: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('s2s_start', {});
    return true;
  }

  /**
   * 通知对话结束
   * @param conversationId 会话ID
   * @returns 是否成功
   */
  notifyEnd(conversationId: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('s2s_end', {});
    return true;
  }

  /**
   * 通知错误
   * @param conversationId 会话ID
   * @param message 错误信息
   * @returns 是否成功
   */
  notifyError(conversationId: string, message: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('s2s_error', { message });
    return true;
  }

  /**
   * 判断客户端是否在线
   * @param conversationId 会话ID
   * @returns 是否在线
   */
  isConnected(conversationId: string): boolean {
    return !!this.clients.get(conversationId)?.connected;
  }

  /**
   * 获取客户端连接参数
   * @param conversationId 会话ID
   * @returns 语音参数或null
   */
  getClientParams(conversationId: string): { voiceId: string; modelCode?: string } | null {
    const client = this.clients.get(conversationId);
    if (!client) return null;
    return {
      voiceId: (client.handshake.query.voiceId as string) || 'zh_female_vv_jupiter_bigtts',
      modelCode: (client.handshake.query.modelCode as string) || undefined,
    };
  }
}
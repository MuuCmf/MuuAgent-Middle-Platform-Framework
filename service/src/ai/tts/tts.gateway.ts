import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * TTS WebSocket 网关
 * 职责：客户端连接管理 + 音频推送，不做业务逻辑
 */
@WebSocketGateway({ namespace: '/tts', cors: { origin: '*', credentials: true } })
export class TtsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TtsGateway.name);

  /** conversationId → Socket */
  private clients = new Map<string, Socket>();

  /**
   * 客户端连接
   * @param client Socket连接
   */
  async handleConnection(client: Socket): Promise<void> {
    const conversationId = client.handshake.query.conversationId as string;
    if (!conversationId) {
      client.emit('error', { message: '缺少 conversationId' });
      client.disconnect();
      return;
    }

    const old = this.clients.get(conversationId);
    if (old && old.id !== client.id) {
      old.disconnect();
    }

    this.clients.set(conversationId, client);
    this.logger.debug(`TTS 连接: ${conversationId}`);
  }

  /**
   * 客户端断开
   * @param client Socket连接
   */
  handleDisconnect(client: Socket): void {
    for (const [convId, socket] of this.clients) {
      if (socket.id === client.id) {
        this.clients.delete(convId);
        break;
      }
    }
  }

  /**
   * 推送音频块
   * @param conversationId 会话ID
   * @param data 音频数据（Base64）
   * @param format 格式
   * @param sequence 序号
   * @param isLast 是否最后一块
   * @param sampleRate 采样率
   * @returns 是否推送成功
   */
  pushAudioChunk(
    conversationId: string,
    data: string,
    format: string,
    sequence: number,
    isLast: boolean,
    sampleRate?: number,
  ): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('audio_chunk', { data, format, sequence, isLast, sampleRate });
    return true;
  }

  /**
   * 通知合成开始
   * @param conversationId 会话ID
   * @returns 是否成功
   */
  notifyStart(conversationId: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('tts_start', {});
    return true;
  }

  /**
   * 通知合成结束
   * @param conversationId 会话ID
   * @returns 是否成功
   */
  notifyEnd(conversationId: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('tts_end', {});
    return true;
  }

  /**
   * 通知合成错误
   * @param conversationId 会话ID
   * @param message 错误信息
   * @returns 是否成功
   */
  notifyError(conversationId: string, message: string): boolean {
    const client = this.clients.get(conversationId);
    if (!client?.connected) return false;
    client.emit('tts_error', { message });
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
  getClientParams(conversationId: string): { voiceId: string; speed: number } | null {
    const client = this.clients.get(conversationId);
    if (!client) return null;
    return {
      voiceId: (client.handshake.query.voiceId as string) || 'Cherry',
      speed: parseFloat(client.handshake.query.speed as string) || 1.0,
    };
  }
}

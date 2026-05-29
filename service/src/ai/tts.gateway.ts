import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * TTS 会话状态
 */
export interface TtsSessionState {
  conversationId: string;
  status: 'idle' | 'streaming' | 'paused' | 'stopped';
  voiceId: string;
  speed: number;
}

/**
 * WebSocket TTS 网关
 *
 * 独立命名空间 /tts，与 SSE 文本流通道分离。
 * 通过 conversationId 与文本流关联。
 */
@WebSocketGateway({
  namespace: '/tts',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TtsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TtsGateway.name);

  /** conversationId → Socket 映射 */
  private sessionMap = new Map<string, Socket>();

  /** socket.id → 会话状态 */
  private sessionState = new Map<string, TtsSessionState>();

  /**
   * 客户端连接处理
   * 从 query 中获取 conversationId 建立关联
   */
  async handleConnection(client: Socket): Promise<void> {
    const conversationId = client.handshake.query.conversationId as string;
    const voiceId = (client.handshake.query.voiceId as string) || 'alloy';
    const speed = parseFloat(client.handshake.query.speed as string) || 1.0;

    if (!conversationId) {
      client.emit('error', { message: '缺少 conversationId' });
      client.disconnect();
      return;
    }

    this.sessionMap.set(conversationId, client);
    this.sessionState.set(client.id, {
      conversationId,
      status: 'idle',
      voiceId,
      speed,
    });

    this.logger.debug(`TTS 客户端已连接: conversationId=${conversationId}`);
  }

  /**
   * 客户端断开连接
   */
  handleDisconnect(client: Socket): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      this.sessionMap.delete(state.conversationId);
    }
    this.sessionState.delete(client.id);
  }

  /**
   * 暂停语音播报
   */
  @SubscribeMessage('pause')
  handlePause(@ConnectedSocket() client: Socket): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      state.status = 'paused';
    }
  }

  /**
   * 恢复语音播报
   */
  @SubscribeMessage('resume')
  handleResume(@ConnectedSocket() client: Socket): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      state.status = 'streaming';
    }
  }

  /**
   * 停止语音播报并清空队列
   */
  @SubscribeMessage('stop')
  handleStop(@ConnectedSocket() client: Socket): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      state.status = 'stopped';
    }
  }

  /**
   * 切换语音
   */
  @SubscribeMessage('change_voice')
  handleChangeVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceId: string },
  ): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      state.voiceId = data.voiceId;
    }
  }

  /**
   * 调整语速
   */
  @SubscribeMessage('change_speed')
  handleChangeSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { speed: number },
  ): void {
    const state = this.sessionState.get(client.id);
    if (state) {
      state.speed = data.speed;
    }
  }

  /**
   * 向指定会话推送音频块
   *
   * @param conversationId 会话ID（对应 SSE 文本流的 conversationId）
   * @param data 音频数据（Base64 编码）
   * @param format 音频格式（mp3/wav/pcm）
   * @param sequence 块序号
   * @param isLast 是否为最后一块
   * @returns 是否成功推送
   */
  pushAudioChunk(
    conversationId: string,
    data: string,
    format: string,
    sequence: number,
    isLast: boolean,
  ): boolean {
    const client = this.sessionMap.get(conversationId);
    if (!client || !client.connected) {
      return false;
    }

    const state = this.sessionState.get(client.id);
    if (state?.status === 'stopped') {
      return false;
    }
    if (state?.status === 'paused') {
      return true;
    }

    client.emit('audio_chunk', {
      data,
      format,
      sequence,
      isLast,
    });

    return true;
  }

  /**
   * 通知客户端 TTS 开始
   */
  notifyStart(conversationId: string, totalSentences: number): boolean {
    const client = this.sessionMap.get(conversationId);
    if (!client || !client.connected) return false;

    const state = this.sessionState.get(client.id);
    if (state) state.status = 'streaming';

    client.emit('tts_start', { totalSentences });
    return true;
  }

  /**
   * 通知客户端 TTS 结束
   */
  notifyEnd(conversationId: string): boolean {
    const client = this.sessionMap.get(conversationId);
    if (!client || !client.connected) return false;

    const state = this.sessionState.get(client.id);
    if (state) state.status = 'idle';

    client.emit('tts_end', {});
    return true;
  }

  /**
   * 通知客户端 TTS 错误
   *
   * @param conversationId 会话ID
   * @param message 错误消息
   * @returns 是否成功通知
   */
  notifyError(conversationId: string, message: string): boolean {
    const client = this.sessionMap.get(conversationId);
    if (!client || !client.connected) return false;

    client.emit('tts_error', { message });
    return true;
  }

  /**
   * 获取当前会话的语音配置
   */
  getSessionVoice(conversationId: string): { voiceId: string; speed: number } | null {
    const client = this.sessionMap.get(conversationId);
    if (!client) return null;

    const state = this.sessionState.get(client.id);
    if (!state) return null;

    return { voiceId: state.voiceId, speed: state.speed };
  }

  /**
   * 检查会话是否已停止
   */
  isStopped(conversationId: string): boolean {
    const client = this.sessionMap.get(conversationId);
    if (!client) return true;

    const state = this.sessionState.get(client.id);
    return state?.status === 'stopped';
  }

  /**
   * 检查会话是否有活跃的 WebSocket 连接
   */
  isConnected(conversationId: string): boolean {
    const client = this.sessionMap.get(conversationId);
    return !!client && client.connected;
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { TtsGateway } from './tts.gateway';
import { TtsSessionManager } from './tts-session.manager';
import { StrategyFactory } from '../strategies/strategy.factory';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TTSExecutionParams } from '../strategies/provider.strategy.interface';

/**
 * TTS 语音合成服务
 *
 * 职责：
 * - 会话模式（commit）：一个对话复用一个WebSocket连接，逐句提交合成
 * - 单次模式（server_commit）：每句创建新连接，用于非对话场景
 * - 批量模式：整段文本一次性合成
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly gateway: TtsGateway,
    private readonly sessionManager: TtsSessionManager,
    private readonly strategyFactory: StrategyFactory,
    private readonly modelRouting: ModelRoutingService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== 会话模式（commit）====================

  /**
   * 确保TTS会话已打开
   *
   * 如果会话已存在且活跃则直接返回true；
   * 如果客户端未连接到Gateway则返回false；
   * 否则尝试打开新会话。
   *
   * @param conversationId 会话ID
   * @param modelCode 模型编码（可选）
   * @returns 会话是否就绪
   */
  async ensureSession(conversationId: string, modelCode?: string): Promise<boolean> {
    return this.sessionManager.ensureSession(conversationId, modelCode);
  }

  /**
   * 发送文本并提交合成（会话模式）
   *
   * 在commit模式下，先追加文本到缓冲区，然后提交触发合成。
   * 音频数据由后台消费者自动推送到客户端。
   *
   * @param conversationId 会话ID
   * @param text 要合成的文本
   */
  sendText(conversationId: string, text: string): void {
    const cleanText = this.cleanText(text);
    if (!cleanText) return;
    this.sessionManager.sendText(conversationId, cleanText);
  }

  /**
   * 关闭TTS会话
   *
   * 发送session.finish通知服务端合成完成，
   * 等待剩余音频推送完毕后关闭WebSocket连接。
   *
   * @param conversationId 会话ID
   */
  async closeSession(conversationId: string): Promise<void> {
    await this.sessionManager.closeSession(conversationId);
  }

  /**
   * 判断TTS会话是否活跃（会话模式）
   * @param conversationId 会话ID
   * @returns 是否活跃
   */
  isTtsSessionActive(conversationId: string): boolean {
    return this.sessionManager.isSessionActive(conversationId);
  }

  // ==================== 单次模式（server_commit）====================

  /**
   * 流式合成（单次模式，每句创建新连接）
   *
   * 适用于非对话场景（如管理后台测试）。
   * 对话场景请使用 ensureSession/sendText/closeSession 会话模式。
   *
   * @param text 文本
   * @param conversationId 会话ID
   * @param voice 音色
   * @param speed 语速
   * @param modelCode 模型编码
   */
  async streamSynthesize(
    text: string,
    conversationId: string,
    voice?: string,
    speed?: number,
    modelCode?: string,
  ): Promise<void> {
    const cleanText = this.cleanText(text);
    if (!cleanText) return;
    if (!this.gateway.isConnected(conversationId)) return;

    await this.doSynthesize(cleanText, conversationId, voice, speed, modelCode);
  }

  /**
   * 批量合成（非实时模式，整段文本一次性合成）
   * @param fullText 完整文本
   * @param conversationId 会话ID
   * @param voice 音色
   * @param speed 语速
   * @param modelCode 模型编码
   */
  async batchSynthesize(
    fullText: string,
    conversationId: string,
    voice?: string,
    speed?: number,
    modelCode?: string,
  ): Promise<void> {
    const cleanText = this.cleanText(fullText);
    if (!cleanText) return;
    if (!this.gateway.isConnected(conversationId)) return;

    this.gateway.notifyStart(conversationId);
    try {
      await this.doSynthesize(cleanText, conversationId, voice, speed, modelCode);
    } finally {
      this.gateway.notifyEnd(conversationId);
    }
  }

  // ==================== 通用工具方法 ====================

  /**
   * 判断文本是否为完整句子
   * @param text 文本
   * @returns 是否完整
   */
  isSentenceComplete(text: string): boolean {
    return !!text && text.length >= 4 && /[。！？.!?\n……]$/.test(text);
  }

  /**
   * 判断客户端是否在线（Socket.IO连接是否活跃）
   * @param conversationId 会话ID
   * @returns 是否在线
   */
  isSessionActive(conversationId: string): boolean {
    return this.gateway.isConnected(conversationId);
  }

  // ==================== 内部方法 ====================

  /**
   * 核心合成：选模型 → 调策略 → 推音频（单次模式）
   * @param text 文本
   * @param conversationId 会话ID
   * @param voice 音色
   * @param speed 语速
   * @param modelCode 模型编码
   */
  private async doSynthesize(
    text: string,
    conversationId: string,
    voice?: string,
    speed?: number,
    modelCode?: string,
  ): Promise<void> {
    try {
      const clientParams = this.gateway.getClientParams(conversationId);
      const effectiveModelCode = modelCode || clientParams?.modelCode || undefined;
      const model = await this.resolveModel(effectiveModelCode, voice);
      const strategy = this.strategyFactory.getStrategy(model.provider);

      if (!strategy.executeTTSStream) {
        this.gateway.notifyError(conversationId, '当前模型不支持流式语音合成');
        return;
      }

      const voiceId = voice || clientParams?.voiceId || 'Cherry';
      const voiceSpeed = speed || clientParams?.speed || 1.0;

      const execParams: TTSExecutionParams = {
        model,
        text,
        voice: voiceId,
        speed: voiceSpeed,
        mode: 'server_commit',
        context: { requestId: conversationId, startTime: Date.now(), clientIp: '', userAgent: '', uid: '', appCode: '' },
      };

      this.logger.debug(`TTS 合成: "${text.slice(0, 30)}...", voice=${voiceId}, modelCode=${effectiveModelCode || 'auto'}`);

      // 通知合成开始
      this.gateway.notifyStart(conversationId);

      let seq = 0;
      for await (const chunk of strategy.executeTTSStream(execParams)) {
        if (!chunk.audioData) continue;
        this.gateway.pushAudioChunk(
          conversationId, chunk.audioData, chunk.format,
          seq++, chunk.isLast, chunk.sampleRate,
        );
      }

      // 通知合成结束
      this.gateway.notifyEnd(conversationId);
    } catch (error) {
      this.logger.error(`TTS 合成失败: ${(error as Error).message}`);
      this.gateway.notifyError(conversationId, `语音合成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 解析模型：指定编码 > 音色关联 > 默认TTS模型
   * @param modelCode 模型编码
   * @param voice 音色
   * @returns 模型信息
   */
  private async resolveModel(modelCode?: string, voice?: string): Promise<any> {
    if (modelCode) {
      try { return await this.modelRouting.selectModelByIntent('tts', 'tts:realtime', modelCode); } catch { /* fallthrough */ }
    }

    if (voice) {
      const code = await this.getVoiceModelCode(voice);
      if (code) {
        try { return await this.modelRouting.selectModelByIntent('tts', 'tts:realtime', code); } catch { /* fallthrough */ }
      }
    }

    const realtime = await this.findRealtimeModel();
    if (realtime) return realtime;

    return this.modelRouting.selectModel('tts');
  }

  /**
   * 从音色配置获取模型编码
   * @param voiceId 音色ID
   * @returns 模型编码或undefined
   */
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

  /**
   * 查找默认实时TTS模型
   * @returns 模型信息或null
   */
  private async findRealtimeModel(): Promise<any | null> {
    try {
      const models = await this.prisma.model.findMany({
        where: { type: 'tts', status: true, capabilities: { contains: 'tts:realtime' } },
        orderBy: { weight: 'desc' },
      });
      return models[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 清洗文本（去除Markdown、Emoji等）
   * @param text 原始文本
   * @returns 清洗后文本
   */
  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

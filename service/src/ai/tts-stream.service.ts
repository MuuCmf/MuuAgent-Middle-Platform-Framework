import { Injectable, Logger } from '@nestjs/common';
import { TtsGateway } from './tts.gateway';
import { StrategyFactory } from './strategies/strategy.factory';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModelRoutingService } from '../model-routing/model-routing.service';
import { TTSExecutionParams, IProviderStrategy } from './strategies/provider.strategy.interface';

/**
 * TTS 会话上下文
 */
interface TtsSessionContext {
  model: any;
  strategy: IProviderStrategy;
  voiceId: string;
  speed: number;
}

/**
 * 流式TTS编排服务
 *
 * 支持两种工作模式：
 * 1. 实时模式（边生成边合成）: Engine 逐句调用 synthesizeSentence()
 * 2. 整段模式（文本完成后合成）: 外部调用 synthesizeAndPush()
 */
@Injectable()
export class TtsStreamService {
  private readonly logger = new Logger(TtsStreamService.name);

  /** conversationId → TTS 会话上下文 */
  private ttsSessions = new Map<string, TtsSessionContext>();

  constructor(
    private readonly strategyFactory: StrategyFactory,
    private readonly modelRoutingService: ModelRoutingService,
    private readonly prisma: PrismaService,
    private readonly ttsGateway: TtsGateway,
  ) {}

  /**
   * 检查 TTS 会话是否活跃
   *
   * @param conversationId 会话ID
   */
  isSessionActive(conversationId: string): boolean {
    return this.ttsGateway.isConnected(conversationId);
  }

  /**
   * 初始化 TTS 会话
   *
   * @param conversationId 会话ID
   * @param appCode 可选应用编码
   * @param modelCode 可选指定模型标识（测试时绕过调度）
   * @returns 是否成功初始化
   */
  async initTtsSession(
    conversationId: string,
    appCode?: string,
    modelCode?: string,
  ): Promise<boolean> {
    if (this.ttsSessions.has(conversationId)) {
      return true;
    }

    const voice = this.ttsGateway.getSessionVoice(conversationId);
    if (!voice) {
      this.logger.warn(`TTS 会话未建立 WebSocket 连接: conversationId=${conversationId}`);
      return false;
    }

    try {
      const model = await this.selectTtsModel(voice.voiceId, appCode, modelCode);
      const strategy = this.strategyFactory.getStrategy(model.provider);

      if (!strategy.executeTTSStream) {
        this.logger.warn(
          `Provider ${model.provider} 不支持流式TTS，将使用整段合成降级`,
        );
        return false;
      }

      this.ttsSessions.set(conversationId, {
        model,
        strategy,
        voiceId: voice.voiceId,
        speed: voice.speed,
      });

      this.ttsGateway.notifyStart(conversationId, 0);
      return true;
    } catch (error) {
      this.logger.error(`TTS 会话初始化失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 合成单个句子并推送
   *
   * @param sentence 单个句子
   * @param conversationId 会话ID
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户标识
   * @param appCode 应用编码
   */
  async synthesizeSentence(
    sentence: string,
    conversationId: string,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<void> {
    const session = this.ttsSessions.get(conversationId);
    if (!session) {
      this.logger.warn(`TTS 会话未初始化: conversationId=${conversationId}`);
      return;
    }

    const trimmed = sentence.trim();
    if (!trimmed) return;

    if (this.ttsGateway.isStopped(conversationId)) return;

    try {
      const voiceConfig = this.ttsGateway.getSessionVoice(conversationId);
      const currentVoice = voiceConfig?.voiceId || session.voiceId;
      const currentSpeed = voiceConfig?.speed || session.speed;

      const execParams: TTSExecutionParams & { context: any } = {
        model: session.model,
        text: trimmed,
        voice: currentVoice,
        speed: currentSpeed,
        context: { requestId: conversationId, startTime: Date.now(), clientIp, userAgent, uid, appCode },
      };

      for await (const chunk of session.strategy.executeTTSStream!(execParams)) {
        if (this.ttsGateway.isStopped(conversationId)) return;

        const pushed = this.ttsGateway.pushAudioChunk(
          conversationId,
          chunk.audioData,
          chunk.format,
          chunk.sequence,
          chunk.isLast,
        );

        if (!pushed) {
          this.logger.debug(`客户端已断开，停止TTS: conversationId=${conversationId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.warn(
        `句子 TTS 合成失败: ${(error as Error).message}, sentence="${trimmed.slice(0, 20)}..."`,
      );
    }
  }

  /**
   * 结束 TTS 会话
   *
   * @param conversationId 会话ID
   */
  finalizeTtsSession(conversationId: string): void {
    this.ttsSessions.delete(conversationId);
    this.ttsGateway.notifyEnd(conversationId);
  }

  /**
   * 合成并推送语音（整段模式）
   *
   * @param fullText 完整文本
   * @param conversationId 会话ID
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户标识
   * @param appCode 应用编码
   * @param initialVoice 初始语音
   * @param initialSpeed 初始语速
   * @param modelCode 可选指定模型标识（测试时绕过调度）
   */
  async synthesizeAndPush(
    fullText: string,
    conversationId: string,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
    initialVoice?: string,
    initialSpeed?: number,
    modelCode?: string,
  ): Promise<void> {
    if (!this.ttsGateway.notifyStart(conversationId, 0)) {
      return;
    }

    try {
      const model = await this.selectTtsModel(initialVoice, appCode, modelCode);
      const strategy = this.strategyFactory.getStrategy(model.provider);

      // 保存会话上下文，使 synthesizeSentence（追加文本）可复用
      this.ttsSessions.set(conversationId, {
        model,
        strategy,
        voiceId: initialVoice || 'alloy',
        speed: initialSpeed || 1.0,
      });

      if (!strategy.executeTTSStream) {
        await this.synthesizeFullAndPush(
          fullText, conversationId, model, strategy,
          clientIp, userAgent, uid, appCode, initialVoice, initialSpeed,
        );
        return;
      }

      const sentences = this.splitSentences(fullText);
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        if (this.ttsGateway.isStopped(conversationId)) return;

        const voiceConfig = this.ttsGateway.getSessionVoice(conversationId);
        const execParams: TTSExecutionParams & { context: any } = {
          model,
          text: sentence,
          voice: voiceConfig?.voiceId || initialVoice,
          speed: voiceConfig?.speed || initialSpeed,
          context: { requestId: conversationId, startTime: Date.now(), clientIp, userAgent, uid, appCode },
        };

        let hasAudio = false;

        for await (const chunk of strategy.executeTTSStream!(execParams)) {
          if (this.ttsGateway.isStopped(conversationId)) return;

          if (!chunk.audioData) {
            if (chunk.isLast) break;
            continue;
          }

          hasAudio = true;
          this.ttsGateway.pushAudioChunk(
            conversationId, chunk.audioData, chunk.format,
            chunk.sequence, chunk.isLast,
          );
        }

        if (!hasAudio) {
          this.logger.warn(`TTS 合成未产出音频，可能模型不可用`);
          this.ttsGateway.notifyError(conversationId, '语音合成失败，模型未返回音频数据');
          return;
        }
      }
    } catch (error) {
      this.logger.error(`TTS流式合成异常: ${(error as Error).message}`);
    } finally {
      this.ttsGateway.notifyEnd(conversationId);
    }
  }

  /**
   * 降级处理：不支持流式的 Provider 使用整段合成方式
   */
  private async synthesizeFullAndPush(
    fullText: string,
    conversationId: string,
    model: any,
    strategy: any,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
    voice?: string,
    speed?: number,
  ): Promise<void> {
    if (!strategy.executeTTS) return;

    try {
      const result = await strategy.executeTTS({
        model,
        text: fullText,
        voice,
        speed,
        context: { requestId: conversationId, clientIp, userAgent, uid, appCode },
      });

      this.ttsGateway.pushAudioChunk(
        conversationId,
        result.audioData as string,
        result.format as string,
        0,
        true,
      );
    } catch (error) {
      this.logger.warn(`整段TTS合成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 选择 TTS 模型
   *
   * 优先级: overrideModelCode > voiceId 关联的模型编码 > 调度默认选择
   *
   * @param voiceId 可选语音ID，用于从语音配置获取关联模型
   * @param appCode 可选应用编码
   * @param overrideModelCode 可选指定模型标识（测试时强制使用，绕过调度）
   * @returns 模型信息
   */
  private async selectTtsModel(
    voiceId?: string,
    appCode?: string,
    overrideModelCode?: string,
  ): Promise<any> {
    // 优先级1：指定模型标识（测试场景绕过调度）
    if (overrideModelCode) {
      try {
        const model = await this.modelRoutingService.selectModelByIntent('tts', 'tts', overrideModelCode);
        if (model) {
          this.logger.debug(`TTS 使用指定模型: ${overrideModelCode}`);
          return model;
        }
      } catch {
        this.logger.warn(`指定模型 ${overrideModelCode} 不可用，降级为语音配置关联`);
      }
    }

    // 优先级2：从语音配置获取关联模型
    let modelCode: string | undefined;
    if (voiceId) {
      try {
        const voiceProfile = await this.prisma.voiceProfile.findFirst({
          where: { voiceId, status: true },
          orderBy: { isDefault: 'desc' },
        });
        if (voiceProfile?.modelCode) {
          modelCode = voiceProfile.modelCode;
        }
      } catch {
        // ignore query error
      }
    }

    if (modelCode) {
      try {
        return await this.modelRoutingService.selectModelByIntent('tts', 'tts', modelCode);
      } catch {
        // fallback to default selection
      }
    }

    // 优先级3：调度默认选择
    return this.modelRoutingService.selectModel('tts');
  }

  /**
   * 检测是否为完整的句子末尾
   *
   * @param text 待检测文本
   * @returns 是否以句末标点结尾
   */
  isSentenceComplete(text: string): boolean {
    if (!text || text.length < 3) return false;
    return /[。！？.!?\n……]$/.test(text.trim());
  }

  /**
   * 将文本按句子切分
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
}
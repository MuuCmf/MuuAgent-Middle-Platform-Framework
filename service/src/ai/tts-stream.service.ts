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
 *
 * 句子队列保证：同一会话的句子按入队顺序串行合成，
 * 避免多句并行导致客户端音频块交错混乱。
 */
@Injectable()
export class TtsStreamService {
  private readonly logger = new Logger(TtsStreamService.name);

  /** conversationId → TTS 会话上下文 */
  private ttsSessions = new Map<string, TtsSessionContext>();

  /** conversationId → 句子串行队列 */
  private sentenceQueues = new Map<string, {
    queue: Array<{
      sentence: string;
      clientIp: string;
      userAgent: string;
      uid?: string;
      appCode?: string;
      resolve: () => void;
      reject: (err: Error) => void;
    }>;
    processing: boolean;
  }>();

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
   * 记录每个会话最后一次使用的 voiceId，用于检测语音切换
   */
  private lastVoiceMap = new Map<string, string>();

  /**
   * 初始化 TTS 会话
   *
   * 首次调用时选择 TTS 模型并建立策略上下文。
   * 如果 WebSocket 尚未连接，会在短时间内轮询等待（最多 5 秒），
   * 以应对新会话时 client 端 WebSocket 连接晚于 LLM 流启动的情况。
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
      this.logger.debug(`initTtsSession 会话已存在: conversationId=${conversationId}`);
      return true;
    }

    // 轮询等待 WebSocket 连接（最多 5 秒）
    const voice = await this.pollSessionVoice(conversationId, 5000);
    if (!voice) {
      this.logger.warn(`TTS 会话未建立 WebSocket 连接: conversationId=${conversationId}`);
      this.ttsGateway.notifyError(conversationId, '语音合成初始化超时：WebSocket 连接未就绪，请检查网络后重试');
      return false;
    }

    this.logger.debug(`pollSessionVoice 成功: voiceId=${voice.voiceId}, speed=${voice.speed}`);

    try {
      // 有显式 modelCode 时（管理端测试），使用 selectTtsModel 按指定模型调度
      // 否则使用 selectStreamTtsModel，按 capabilities 筛选支持实时流式的模型
      const model = modelCode
        ? await this.selectTtsModel(voice.voiceId, appCode, modelCode)
        : await this.selectStreamTtsModel(voice.voiceId, appCode);

      this.logger.debug(`TTS 模型选择: code=${model.code}, provider=${model.provider}`);

      const strategy = this.strategyFactory.getStrategy(model.provider);

      if (!strategy.executeTTSStream) {
        this.logger.warn(
          `Provider ${model.provider} 不支持流式TTS，将使用整段合成降级`,
        );
        this.ttsGateway.notifyError(conversationId, '当前模型不支持实时流式语音合成');
        return false;
      }

      this.ttsSessions.set(conversationId, {
        model,
        strategy,
        voiceId: voice.voiceId,
        speed: voice.speed,
      });

      this.lastVoiceMap.set(conversationId, voice.voiceId);

      this.ttsGateway.notifyStart(conversationId, 0);
      this.logger.debug(`TTS 会话初始化成功: conversationId=${conversationId}, model=${model.code}`);
      return true;
    } catch (error) {
      this.logger.error(`TTS 会话初始化失败: ${(error as Error).message}`);
      this.ttsGateway.notifyError(conversationId, `语音合成初始化失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 轮询等待 WebSocket 会话就绪
   *
   * 新会话时 client 端可能尚未完成 WebSocket 连接，
   * 在此处短时轮询等待，避免 LLM 流结束时 TTS 错过末句。
   *
   * @param conversationId 会话ID
   * @param timeoutMs 总超时毫秒
   * @returns 会话语音配置，超时返回 null
   */
  private async pollSessionVoice(
    conversationId: string,
    timeoutMs: number,
  ): Promise<{ voiceId: string; speed: number } | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const voice = this.ttsGateway.getSessionVoice(conversationId);
      if (voice) return voice;
      await new Promise((r) => setTimeout(r, 200));
    }
    return this.ttsGateway.getSessionVoice(conversationId);
  }

  /**
   * 合成单个句子并推送
   *
   * 句子入队后串行执行，同一会话的句子按顺序逐一合成，
   * 确保音频块按正确顺序到达客户端。
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
      this.logger.debug(`synthesizeSentence 跳过: 会话未找到 conversationId=${conversationId}`);
      return;
    }

    const trimmed = sentence.trim();
    if (!trimmed) return;

    if (this.ttsGateway.isStopped(conversationId)) return;

    // 入队等待串行合成
    return new Promise<void>((resolve, reject) => {
      let entry = this.sentenceQueues.get(conversationId);
      if (!entry) {
        entry = { queue: [], processing: false };
        this.sentenceQueues.set(conversationId, entry);
      }
      entry.queue.push({ sentence: trimmed, clientIp, userAgent, uid, appCode, resolve, reject });
      this.processSentenceQueue(conversationId);
    });
  }

  /**
   * 串行处理句子队列
   *
   * 同一时间每个会话只有一个句子在合成，保证音频顺序。
   */
  private async processSentenceQueue(conversationId: string): Promise<void> {
    const entry = this.sentenceQueues.get(conversationId);
    if (!entry || entry.processing || entry.queue.length === 0) return;

    entry.processing = true;

    while (entry.queue.length > 0) {
      const item = entry.queue[0];
      const session = this.ttsSessions.get(conversationId);
      if (!session) {
        entry.queue.shift();
        continue;
      }

      if (this.ttsGateway.isStopped(conversationId)) {
        entry.queue.shift();
        item.reject(new Error('会话已停止'));
        continue;
      }

      try {
        const voiceConfig = this.ttsGateway.getSessionVoice(conversationId);
        const currentVoice = voiceConfig?.voiceId || session.voiceId;
        const currentSpeed = voiceConfig?.speed || session.speed;

        // 每个句子开始前检查 WebSocket 连接
        if (!this.ttsGateway.isConnected(conversationId)) {
          this.logger.warn(`TTS 句子跳过: WebSocket 未连接, sentence="${item.sentence.slice(0, 20)}..."`);
          entry.queue.shift();
          item.reject(new Error('WebSocket 未连接'));
          continue;
        }

        // Issue 15: 检测语音切换，若 voiceId 变化则重新选择模型
        const lastVoice = this.lastVoiceMap.get(conversationId);
        if (lastVoice && currentVoice !== lastVoice) {
          this.lastVoiceMap.set(conversationId, currentVoice);
          try {
            const newModel = await this.selectStreamTtsModel(currentVoice, item.appCode);
            const newStrategy = this.strategyFactory.getStrategy(newModel.provider);
            if (newStrategy.executeTTSStream) {
              session.model = newModel;
              session.strategy = newStrategy;
              session.voiceId = currentVoice;
              this.logger.debug(`语音切换触发模型重选: voice=${currentVoice}, model=${newModel.code}`);
            }
          } catch (e) {
            this.logger.warn(`语音切换后模型重选失败，继续使用当前模型: ${(e as Error).message}`);
          }
        }

        // 净化文本：去除 Markdown 标记、emoji 等 TTS 模型无法正确处理的内容
        const cleanText = this.sanitizeText(item.sentence);

        // 跳过无效文本（空文本或只有空白字符）
        if (!cleanText || cleanText.trim().length === 0) {
          this.logger.debug(`TTS 跳过无效文本: sentence="${item.sentence.slice(0, 20)}..."`);
          entry.queue.shift();
          item.resolve();
          continue;
        }

        const execParams: TTSExecutionParams & { context: any } = {
          model: session.model,
          text: cleanText,
          voice: currentVoice,
          speed: currentSpeed,
          context: { requestId: conversationId, startTime: Date.now(), clientIp: item.clientIp, userAgent: item.userAgent, uid: item.uid, appCode: item.appCode },
        };

        this.logger.debug(`TTS 开始合成句子: len=${cleanText.length}, voice=${currentVoice}`);

        let hasAudio = false;

        for await (const chunk of session.strategy.executeTTSStream!(execParams)) {
          if (this.ttsGateway.isStopped(conversationId)) break;

          if (!chunk.audioData) {
            if (chunk.isLast) break;
            continue;
          }

          hasAudio = true;

          const pushed = this.ttsGateway.pushAudioChunk(
            conversationId,
            chunk.audioData,
            chunk.format,
            chunk.sequence,
            chunk.isLast,
            chunk.sampleRate,
          );

          if (!pushed) {
            this.logger.warn(`TTS 音频块推送失败(socket可能断开)，继续处理剩余块`);
          }
        }

        if (!hasAudio) {
          this.logger.warn(`TTS 句子合成未产出音频: sentence="${item.sentence.slice(0, 20)}..."`);
        }

        entry.queue.shift();
        item.resolve();
      } catch (error) {
        entry.queue.shift();
        this.logger.warn(
          `句子 TTS 合成失败(跳过): ${(error as Error).message}, sentence="${item.sentence.slice(0, 20)}..."`,
        );
        item.reject(error as Error);
      }
    }

    entry.processing = false;
  }

  /**
   * 结束 TTS 会话
   *
   * 清理会话上下文和句子队列，通知客户端。
   *
   * @param conversationId 会话ID
   */
  finalizeTtsSession(conversationId: string): void {
    this.ttsSessions.delete(conversationId);
    this.sentenceQueues.delete(conversationId);
    this.lastVoiceMap.delete(conversationId);
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
    if (!this.ttsGateway.isConnected(conversationId)) {
      return;
    }

    const sentences = this.splitSentences(fullText);
    if (!this.ttsGateway.notifyStart(conversationId, sentences.length)) {
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
            chunk.sequence, chunk.isLast, chunk.sampleRate,
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
   * 净化文本：去除 Markdown 标记和 emoji，保留纯文本内容
   *
   * LLM 回复中常包含 Markdown 格式（如 **小明**、`代码`、 [链接](url)）
   * 和 emoji 字符，TTS 模型无法正确处理这些符号，可能导致合成提前中断、
   * 产生杂音或静默失败。
   *
   * @param text 原始文本
   * @returns 净化后的纯文本
   */
  private sanitizeText(text: string): string {
    if (!text) return '';

    let clean = text;

    // 1. 移除 Markdown 链接 [text](url) → text
    clean = clean.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // 2. 移除 Markdown 图片 ![alt](url)
    clean = clean.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');

    // 3. 移除 Markdown 加粗/斜体 **text** → text, *text* → text
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
    clean = clean.replace(/\*([^*]+)\*/g, '$1');
    clean = clean.replace(/__([^_]+)__/g, '$1');
    clean = clean.replace(/_([^_]+)_/g, '$1');

    // 4. 移除 Markdown 行内代码 `code` → code
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // 5. 移除 Markdown 代码块 ```...```
    clean = clean.replace(/```[\s\S]*?```/g, '');
    clean = clean.replace(/~~~[\s\S]*?~~~/g, '');

    // 6. 移除 Markdown 标题标记 # 
    clean = clean.replace(/^#{1,6}\s+/gm, '');

    // 7. 移除 Markdown 水平线 ---, ***, ___
    clean = clean.replace(/^[-*_]{3,}\s*$/gm, '');

    // 8. 移除 emoji 和特殊符号（常见 emoji 范围）
    clean = clean.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FB}\u{25FC}\u{25FD}\u{25FE}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu,
      '',
    );

    // 9. 规范化空白：多个空格/换行合并为单个空格
    // 注意：中文场景下换行不具有语义停顿含义，合并为空格保证 TTS 朗读流畅；
    // 如需保留段落停顿，应在 TTS 模型服务端配置 SSML 标记。
    clean = clean.replace(/\s+/g, ' ');

    // 10. 移除开头和结尾的空白
    clean = clean.trim();

    return clean;
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
   * 选择实时流式 TTS 模型
   *
   * 根据 capabilities 字段筛选支持实时合成的模型。
   * capabilities 为 JSON 数组字符串：["tts:realtime"] 表示支持实时流式合成。
   *
   * 优先级: voiceId 关联的模型编码 > 调度默认选择（仅限支持实时合成的模型）
   *
   * @param voiceId 可选语音ID，用于从语音配置获取关联模型
   * @param appCode 可选应用编码
   * @returns 模型信息
   */
  private async selectStreamTtsModel(
    voiceId?: string,
    appCode?: string,
  ): Promise<any> {
    // 优先级1：从语音配置获取关联模型
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
        const model = await this.modelRoutingService.selectModelByIntent('tts', 'tts:realtime', modelCode);
        if (model) {
          this.logger.debug(`流式TTS 使用语音关联模型: ${model.code}`);
          return model;
        }
      } catch {
        this.logger.warn(`语音关联模型 ${modelCode} 不支持实时流式，降级为调度选择`);
      }
    }

    // 优先级2：从数据库查询支持实时合成的 TTS 模型
    try {
      const models = await this.prisma.model.findMany({
        where: {
          type: 'tts',
          status: true,
          capabilities: { contains: 'tts:realtime' },
        },
        orderBy: { weight: 'desc' },
      });

      if (models.length > 0) {
        this.logger.debug(`流式TTS 选择 capability 匹配模型: ${models[0].code}`);
        return models[0];
      }
    } catch {
      // fallback to default selection
    }

    // 优先级3：降级到普通 TTS 模型
    this.logger.warn('未找到支持实时流式的 TTS 模型，降级使用普通 TTS 模型');
    return this.selectTtsModel(voiceId, appCode);
  }

  /**
   * 检测是否为完整的句子末尾
   * 与流式句子检测逻辑保持一致：最少4字符，以句末标点结尾
   *
   * @param text 待检测文本
   * @returns 是否以句末标点结尾
   */
  isSentenceComplete(text: string): boolean {
    if (!text || text.length < 4) return false;
    return /[。！？.!?\n……]$/.test(text);
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

      if (buffer.length >= 4 || this.isSentenceComplete(buffer)) {
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
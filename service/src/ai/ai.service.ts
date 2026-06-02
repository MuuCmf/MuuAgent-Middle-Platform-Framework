import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ModelRoutingService } from "../model-routing/model-routing.service";
import { ModelService } from '../model/model.service';
import { ModelTemplateService } from '../model-template/model-template.service';
import { IntentClassifierService } from '../intent/intent.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import { AppUsageService } from '../common/services/app-usage.service';
import {
  AiInvokeDto,
  EmbeddingDto,
  ImageGenerateDto,
  TtsDto,
  AsrDto,
  S2SDto,
} from './dto/ai.dto';
import { Model } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsolationContext } from '../common/services/base-isolated.service';
import { mergeModelParams, ModelParams } from '../common/utils/model-params.util';
import { StrategyFactory } from './strategies/strategy.factory';
import { ModelExecutor } from './core/model.executor';
import { ContextManager } from './core/context.manager';
import { ErrorHandler, NormalizedError } from './handlers/error.handler';
import { LogService, LogData } from './infrastructure/log.service';
import { StreamProcessor } from './core/stream.processor';
import { ToolCallParser } from './parsers/tool-call.parser';
import { TtsService } from './tts/tts.service';
import {
  ExecutionContext,
  ExecutionResult,
  StreamChunk,
  ExecutionParams,
  ToolCall,
} from './interfaces/executor.interface';
import type { ModelMessage, Tool } from 'ai';
import { StreamEmitter, StreamEventType, StreamEvents } from '../stream';

/**
 * generateText 参数接口
 */
export interface GenerateTextParams {
  model: Model;
  system?: string;
  messages: ModelMessage[];
  tools?: Record<string, Tool>;
  toolChoice?: any;
  temperature?: number;
  maxTokens?: number;
  onStepFinish?: (step: any) => void;
  clientIp: string;
  userAgent?: string;
  uid?: string;
  appCode?: string;
}

/**
 * streamText 参数接口
 */
export interface StreamTextParams extends GenerateTextParams {
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolCall: { name: string; args: any }) => void;
  onFinish?: (result: any) => void;
  onError?: (error: any) => void;
}

/**
 * generateText 结果接口
 */
export interface GenerateTextResult {
  text: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  steps?: any[];
  toolCalls?: ToolCall[];
}

/**
 * AI统一调用服务
 * 使用分层架构实现，提供清晰的分层和更好的可维护性
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * 构造函数
   * @param mcpService MCP调度服务
   * @param modelService 模型服务
   * @param modelTemplateService 模型参数模板服务
   * @param conversationService 会话服务
   * @param intentClassifier 意图分类器
   * @param strategyFactory 策略工厂
   * @param modelExecutor 模型执行器
   * @param contextManager 上下文管理器
   * @param errorHandler 错误处理器
   * @param logService 日志服务
   * @param streamProcessor 流式处理器
   * @param toolCallParser 工具调用解析器
   * @param appUsageService 应用使用量服务
   */
  constructor(
    private mcpService: ModelRoutingService,
    private modelService: ModelService,
    private modelTemplateService: ModelTemplateService,
    private conversationService: ConversationService,
    private intentClassifier: IntentClassifierService,
    private strategyFactory: StrategyFactory,
    private modelExecutor: ModelExecutor,
    private contextManager: ContextManager,
    private errorHandler: ErrorHandler,
    private logService: LogService,
    private streamProcessor: StreamProcessor,
    private toolCallParser: ToolCallParser,
    private appUsageService: AppUsageService,
    private prisma: PrismaService,
    private ttsService: TtsService,
  ) {}

  /**
   * 统一AI调用(非流式)
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 调用结果
   */
  async invoke(
    dto: AiInvokeDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'llm';

    this.logger.debug(`AI调用开始: requestId=${context.requestId}, modelType=${modelType}, modelCode=${dto.modelCode}`);

    try {
      const isolationContext: IsolationContext = {
        appCode: appCode || null,
        skipIsolation: false,
      };

      const lastUserMessage = dto.messages.filter((m) => m.role === 'user').pop();
      const userContent = lastUserMessage?.content || '';

      // 意图识别：根据用户消息分类意图
      const intentResult = await this.intentClassifier.classify(userContent);
      const intent = intentResult.intent;
      const intentModelType = this.intentClassifier.getModelTypeForIntent(intent);
      const effectiveModelType = intentModelType !== modelType ? intentModelType : modelType;
      this.logger.debug(`意图分类: intent=${intent}, modelType=${effectiveModelType}`);

      // 先选择模型，再确定会话目标ID，确保会话绑定到实际使用的模型而非虚拟 mcp 标识
      const model = await this.selectModel(dto.modelCode, effectiveModelType, intent);
      const resolvedTargetId = dto.modelCode || model.code;

      // 根据模型类型确定会话类型
      const conversationType = this.getConversationTypeByModelType(effectiveModelType);

      const conversation = await this.conversationService.getOrCreate(
        conversationType,
        resolvedTargetId,
        dto.conversationId,
        uid,
        isolationContext,
      );

      const messagesWithHistory = await this.buildMessagesWithHistory(
        conversation,
        dto.messages,
      );

      if (lastUserMessage) {
        await this.conversationService.addMessage(
          conversation.id as any,
          'user',
          lastUserMessage.content,
        );
      }

      await this.mcpService.checkCircuit(model.id as any);
      await this.mcpService.checkConcurrency(model.id as any);

      const template = await this.modelTemplateService.getDefaultTemplate(effectiveModelType);
      const mergedParams = mergeModelParams({
        callParams: {
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        templateParams: template ? {
          temperature: template.temperature,
          topP: template.topP,
          maxTokens: template.maxTokens,
          contextWindow: template.contextWindow,
        } : null,
      });
      this.logger.debug(`参数合并结果: temperature=${mergedParams.temperature}, maxTokens=${mergedParams.maxTokens}, topP=${mergedParams.topP}`);

      const executionParams: ExecutionParams = {
        model,
        messages: messagesWithHistory as any,
        options: {
          temperature: mergedParams.temperature,
          maxTokens: mergedParams.maxTokens,
        },
        context,
      };

      const result = await this.modelExecutor.execute(executionParams);

      await this.mcpService.reportSuccess(model.id as any);

      const assistantMessage = result.content;
      if (assistantMessage) {
        await this.conversationService.addMessage(
          conversation.id as any,
          'assistant',
          assistantMessage,
        );

        if (conversation.messageCount === 0) {
          await this.conversationService.generateTitle(conversation.id as any);
        }
      }

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(result.raw || result),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
        uid,
        appCode,
      });

      /** 同步 Token 使用量到 AppUsage（用于配额检查） */
      if (appCode && result.usage?.promptTokens && result.usage?.completionTokens) {
        await this.appUsageService.incrementTokenCount(
          appCode,
          result.usage.promptTokens,
          result.usage.completionTokens,
        );
      }

      await this.mcpService.reportSuccess(model.id as any);

      return {
        ...(result.raw || result),
        conversationId: conversation.id as any,
      };
    } catch (error) {
      return this.handleInvokeError(error, context, dto, modelType, clientIp, userAgent, uid, appCode);
    }
  }

  /**
   * SSE流式调用（基于 StreamEmitter）
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @param emitter 流式发射器
   */
  async streamInvoke(
    dto: AiInvokeDto,
    clientIp: string,
    userAgent: string,
    uid: string | undefined,
    appCode: string | undefined,
    emitter: StreamEmitter,
  ): Promise<void> {
    let modelId: string | null = null;
    let concurrencyAcquired = false;

    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'llm';

    this.logger.debug(`[Stream] 开始处理流式请求: requestId=${context.requestId}`);

    // ========== TTS 实时合成状态 ==========
    let conversationIdStr = '';
    let ttsSentenceBuffer = '';
    let ttsSessionOpened = false;
    let ttsUseSingleMode = false;

    try {
      const isolationContext: IsolationContext = {
        appCode: appCode || null,
        skipIsolation: false,
      };

      const lastUserMessage = dto.messages.filter((m) => m.role === 'user').pop();
      const userContent = lastUserMessage?.content || '';

      // 意图识别：根据用户消息分类意图
      const intentResult = await this.intentClassifier.classify(userContent);
      const intent = intentResult.intent;
      const intentModelType = this.intentClassifier.getModelTypeForIntent(intent);
      const effectiveModelType = intentModelType !== modelType ? intentModelType : modelType;
      this.logger.debug(`[Stream] 意图分类: intent=${intent}, modelType=${effectiveModelType}`);

      // 先选择模型，再确定会话目标ID，确保会话绑定到实际使用的模型而非虚拟 mcp 标识
      const model = await this.selectModel(dto.modelCode, effectiveModelType, intent);
      modelId = model.id as any;
      const resolvedTargetId = dto.modelCode || model.code;

      // 根据模型类型确定会话类型
      const conversationType = this.getConversationTypeByModelType(effectiveModelType);

      const conversation = await this.conversationService.getOrCreate(
        conversationType,
        resolvedTargetId,
        dto.conversationId,
        uid,
        isolationContext,
      );

      conversationIdStr = String(conversation.id);

      const messagesWithHistory = await this.buildMessagesWithHistory(
        conversation,
        dto.messages,
      );

      if (lastUserMessage) {
        await this.conversationService.addMessage(
          conversation.id as any,
          'user',
          lastUserMessage.content,
        );
      }

      if (emitter.completed) {
        this.logger.debug(`[Stream] 请求已取消: requestId=${context.requestId}`);
        return;
      }

      emitter.emit(StreamEvents.conversationId(conversation.id as any));

      await this.mcpService.checkCircuit(model.id as any);
      await this.mcpService.checkConcurrency(model.id as any);
      concurrencyAcquired = true;

      const template = await this.modelTemplateService.getDefaultTemplate(effectiveModelType);
      const mergedParams = mergeModelParams({
        callParams: {
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        templateParams: template ? {
          temperature: template.temperature,
          topP: template.topP,
          maxTokens: template.maxTokens,
          contextWindow: template.contextWindow,
        } : null,
      });
      this.logger.debug(`[Stream] 参数合并结果: temperature=${mergedParams.temperature}, maxTokens=${mergedParams.maxTokens}, topP=${mergedParams.topP}`);

      let accumulatedContent = '';
      const chunks: StreamChunk[] = [];

      const executionParams: ExecutionParams = {
        model,
        messages: messagesWithHistory as any,
        options: {
          temperature: mergedParams.temperature,
          maxTokens: mergedParams.maxTokens,
        },
        context,
      };

      let blockIndex = 0;
      let currentBlockType: 'text' | 'tool_call' | null = null;

      for await (const chunk of this.modelExecutor.stream(executionParams)) {
        if (emitter.completed) {
          this.logger.debug(`[Stream] 流式传输被取消: requestId=${context.requestId}`);
          break;
        }

        chunks.push(chunk);

        if (chunk.type === 'text-delta' && chunk.delta) {
          if (currentBlockType !== 'text') {
            if (currentBlockType !== null) {
              emitter.emitContentBlockStop(currentBlockType, blockIndex - 1);
            }
            emitter.emitContentBlockStart('text', blockIndex);
            currentBlockType = 'text';
            blockIndex++;
          }
          accumulatedContent += chunk.delta;
          emitter.emitTextDelta(chunk.delta);

          ttsSentenceBuffer += chunk.delta;
          if (this.ttsService.isSentenceComplete(ttsSentenceBuffer)) {
            const sentence = ttsSentenceBuffer;
            ttsSentenceBuffer = '';

            if (!ttsSessionOpened && !ttsUseSingleMode) {
              ttsSessionOpened = await this.ttsService.ensureSession(conversationIdStr);
              if (!ttsSessionOpened) {
                ttsUseSingleMode = true;
                this.logger.debug(`TTS 会话模式不可用，降级为单次合成模式: conversationId=${conversationIdStr}`);
              }
            }
            if (ttsSessionOpened) {
              this.ttsService.sendText(conversationIdStr, sentence);
            } else if (ttsUseSingleMode) {
              this.ttsService.streamSynthesize(sentence, conversationIdStr).catch((e: Error) => {
                this.logger.warn(`TTS 单次合成失败: ${e.message}`);
              });
            }
          }
        } else if (chunk.type === 'tool-call' && chunk.toolCall) {
          if (currentBlockType !== null) {
            emitter.emitContentBlockStop(currentBlockType, blockIndex - 1);
          }
          emitter.emitContentBlockStart('tool_call', blockIndex, chunk.toolCall.toolName);
          currentBlockType = 'tool_call';
          blockIndex++;
          emitter.emit(StreamEvents.toolCall(
            chunk.toolCall.toolName,
            chunk.toolCall.args as Record<string, unknown>,
          ));
          emitter.emitContentBlockStop('tool_call', blockIndex - 1);
          currentBlockType = null;
        } else if (chunk.type === 'error' && chunk.error) {
          throw new Error(chunk.error.message);
        }
      }

      if (currentBlockType !== null) {
        emitter.emitContentBlockStop(currentBlockType, blockIndex - 1);
      }

      // ========== LLM 流结束 — flush 剩余文本并关闭TTS会话 ==========
      if (ttsSentenceBuffer.trim()) {
        if (!ttsSessionOpened && !ttsUseSingleMode) {
          ttsSessionOpened = await this.ttsService.ensureSession(conversationIdStr);
          if (!ttsSessionOpened) {
            ttsUseSingleMode = true;
          }
        }
        if (ttsSessionOpened) {
          this.ttsService.sendText(conversationIdStr, ttsSentenceBuffer.trim());
        } else if (ttsUseSingleMode) {
          this.ttsService.streamSynthesize(ttsSentenceBuffer.trim(), conversationIdStr).catch((e: Error) => {
            this.logger.warn(`TTS 单次合成失败: ${e.message}`);
          });
        }
      }
      // 总是尝试关闭会话（closeSession 在无会话时是空操作）
      await this.ttsService.closeSession(conversationIdStr).catch(() => {});

      if (emitter.completed) {
        return;
      }

      await this.mcpService.reportSuccess(model.id as any);

      if (accumulatedContent) {
        await this.conversationService.addMessage(
          conversation.id as any,
          'assistant',
          accumulatedContent,
        );

        if (conversation.messageCount === 0) {
          await this.conversationService.generateTitle(conversation.id as any);
        }
      }

      const finishChunk = chunks.find((c) => c.type === 'finish');
      const usage = finishChunk?.finish?.usage;

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify({ content: accumulatedContent }),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
        uid,
        appCode,
      });

      /** 同步 Token 使用量到 AppUsage（用于配额检查） */
      if (appCode && usage?.promptTokens && usage?.completionTokens) {
        await this.appUsageService.incrementTokenCount(
          appCode,
          usage.promptTokens,
          usage.completionTokens,
        );
      }

      emitter.emitDone();
    } catch (error) {
      // TTS 清理：发生错误时刷新剩余 buffer 并关闭会话
      if (ttsSentenceBuffer.trim() && conversationIdStr) {
        if (!ttsSessionOpened && !ttsUseSingleMode) {
          ttsSessionOpened = await this.ttsService.ensureSession(conversationIdStr).catch(() => false);
          if (!ttsSessionOpened) {
            ttsUseSingleMode = true;
          }
        }
        if (ttsSessionOpened) {
          this.ttsService.sendText(conversationIdStr, ttsSentenceBuffer.trim());
        } else if (ttsUseSingleMode) {
          this.ttsService.streamSynthesize(ttsSentenceBuffer.trim(), conversationIdStr).catch(() => {});
        }
      }
      if (conversationIdStr) {
        await this.ttsService.closeSession(conversationIdStr).catch(() => {});
      }

      await this.handleStreamError(
        error,
        context,
        dto,
        modelType,
        clientIp,
        userAgent,
        uid,
        appCode,
        modelId,
        emitter,
      );
    } finally {
      if (concurrencyAcquired && modelId) {
        await this.mcpService.releaseConcurrency(modelId);
      }
    }
  }

  /**
   * 处理流式调用错误
   */
  private async handleStreamError(
    error: unknown,
    context: ExecutionContext,
    dto: AiInvokeDto,
    modelType: string,
    clientIp: string,
    userAgent: string,
    uid: string | undefined,
    appCode: string | undefined,
    modelId: string | null,
    emitter: StreamEmitter,
  ): Promise<void> {
    const normalized = this.errorHandler.normalize(error);

    this.logger.error(
      `[Stream] 流式调用错误: requestId=${context.requestId}, error=${normalized.message}`,
      normalized.raw,
    );

    if (modelId) {
      await this.mcpService.reportError(modelId);
    }

    await this.logService.saveLog({
      modelId: modelId,
      modelCode: 'unknown',
      modelType,
      request: JSON.stringify(dto),
      response: normalized.message,
      costMs: this.contextManager.calculateDuration(context),
      success: false,
      clientIp,
      userAgent,
      errorMessage: normalized.message,
      uid,
      appCode,
    });

    emitter.emitError(normalized.message);
  }

  /**
   * Embedding向量生成
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 向量结果
   */
  async embedding(
    dto: EmbeddingDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'embedding';

    this.logger.debug(`Embedding调用开始: requestId=${context.requestId}, modelCode=${dto.modelCode}`);

    try {
      const model = await this.selectModel(dto.modelCode, modelType);

      await this.mcpService.checkCircuit(model.id as any);

      const strategy = this.strategyFactory.getStrategy(model.provider);
      const result = await strategy.execute({
        model,
        messages: [{ role: 'user', content: Array.isArray(dto.input) ? dto.input.join('\n') : dto.input }] as any,
        context,
      });

      await this.mcpService.reportSuccess(model.id as any);

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(result.raw || result),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        uid,
        appCode,
      });

      await this.mcpService.reportSuccess(model.id as any);

      return (result.raw || result) as Record<string, unknown>;
    } catch (error) {
      const model = await this.selectModel(dto.modelCode, modelType).catch(() => null);
      if (model) {
        await this.mcpService.reportError(model.id as any);
      }

      const normalized = this.errorHandler.normalize(error);
      await this.logService.saveLog({
        modelId: model?.id as any || 'unknown',
        modelCode: model?.code || 'unknown',
        modelType,
        request: JSON.stringify(dto),
        response: normalized.message,
        costMs: this.contextManager.calculateDuration(context),
        success: false,
        clientIp,
        userAgent,
        errorMessage: normalized.message,
        uid,
        appCode,
      });

      throw new HttpException(
        `Embedding生成失败: ${normalized.message}`,
        normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 文生图
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 图片结果
   */
  async imageGenerate(
    dto: ImageGenerateDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'image';

    this.logger.debug(`图片生成开始: requestId=${context.requestId}, modelCode=${dto.modelCode}`);

    try {
      const model = await this.selectModel(dto.modelCode, modelType);

      await this.mcpService.checkCircuit(model.id as any);

      const strategy = this.strategyFactory.getStrategy(model.provider);
      const result = await strategy.execute({
        model,
        messages: [{ role: 'user', content: dto.prompt }] as any,
        options: {
          temperature: 1,
        },
        context,
      });

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(result.raw || result),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        uid,
        appCode,
      });

      await this.mcpService.reportSuccess(model.id as any);

      return (result.raw || result) as Record<string, unknown>;
    } catch (error) {
      const model = await this.selectModel(dto.modelCode, modelType).catch(() => null);
      if (model) {
        await this.mcpService.reportError(model.id as any);
      }

      const normalized = this.errorHandler.normalize(error);
      throw new HttpException(
        `图片生成失败: ${normalized.message}`,
        normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * TTS语音合成
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 音频结果
   */
  async tts(
    dto: TtsDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'tts';

    // 若未指定模型标识，尝试从语音配置中获取
    let modelCode = dto.modelCode;
    if (!modelCode && dto.voice) {
      try {
        const voiceProfile = await this.prisma.voiceProfile.findFirst({
          where: { voiceId: dto.voice, status: true },
          orderBy: { isDefault: 'desc' },
        });
        if (voiceProfile?.modelCode) {
          modelCode = voiceProfile.modelCode;
          this.logger.debug(`TTS从语音配置获取模型标识: voice=${dto.voice}, modelCode=${modelCode}`);
        }
      } catch {
        // 查询失败不影响主流程
      }
    }

    this.logger.debug(`TTS语音合成开始: requestId=${context.requestId}, modelCode=${modelCode}`);

    try {
      const model = await this.selectModel(modelCode, modelType);
      
      await this.mcpService.checkCircuit(model.id as any);

      const strategy = this.strategyFactory.getStrategy(model.provider);
      
      if (!strategy.executeTTS) {
        throw new HttpException(
          `模型提供商 ${model.provider} 不支持TTS功能`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await strategy.executeTTS({
        model,
        text: dto.text,
        voice: dto.voice,
        speed: dto.speed,
        context,
      });

      await this.mcpService.reportSuccess(model.id as any);

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify({ audioUrl: result.audioUrl, format: result.format }),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        uid,
        appCode,
      });

      return {
        audioUrl: result.audioUrl,
        audioData: result.audioData,
        format: result.format,
        duration: result.duration,
      };
    } catch (error) {
      const model = await this.selectModel(modelCode, modelType).catch(() => null);
      if (model) {
        await this.mcpService.reportError(model.id as any);
      }

      const normalized = this.errorHandler.normalize(error);
      throw new HttpException(
        `语音合成失败: ${normalized.message}`,
        normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ASR语音识别
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 识别结果
   */
  async asr(
    dto: AsrDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 'asr';

    this.logger.debug(`ASR语音识别开始: requestId=${context.requestId}, modelCode=${dto.modelCode}`);

    try {
      const model = await this.selectModel(dto.modelCode, modelType);
      
      await this.mcpService.checkCircuit(model.id as any);

      const strategy = this.strategyFactory.getStrategy(model.provider);
      
      if (!strategy.executeASR) {
        throw new HttpException(
          `模型提供商 ${model.provider} 不支持ASR功能`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await strategy.executeASR({
        model,
        audio: dto.audio,
        format: dto.format,
        context,
      });

      await this.mcpService.reportSuccess(model.id as any);

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify({ format: dto.format, audioLength: dto.audio.length }),
        response: JSON.stringify({ text: result.text }),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        uid,
        appCode,
      });

      return {
        text: result.text,
        confidence: result.confidence,
        language: result.language,
      };
    } catch (error) {
      const model = await this.selectModel(dto.modelCode, modelType).catch(() => null);
      if (model) {
        await this.mcpService.reportError(model.id as any);
      }

      const normalized = this.errorHandler.normalize(error);
      throw new HttpException(
        `语音识别失败: ${normalized.message}`,
        normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * S2S端到端语音
   * @param dto S2S调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户标识
   * @param appCode 应用编码
   * @returns {Promise<Record<string, unknown>>} 语音结果
   */
  async s2s(
    dto: S2SDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const context = this.contextManager.createFromParams(
      clientIp,
      userAgent,
      uid,
      appCode,
    );

    const modelType = dto.modelType || 's2s';

    this.logger.debug(`S2S端到端语音开始: requestId=${context.requestId}, modelCode=${dto.modelCode}`);

    try {
      const model = await this.selectModel(dto.modelCode, modelType);

      await this.mcpService.checkCircuit(model.id as any);

      const strategy = this.strategyFactory.getStrategy(model.provider);

      if (!strategy.executeS2S) {
        throw new HttpException(
          `模型提供商 ${model.provider} 不支持S2S功能`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await strategy.executeS2S({
        model,
        audio: dto.audio,
        audioFormat: dto.audioFormat,
        voice: dto.voice,
        context,
      });

      await this.mcpService.reportSuccess(model.id as any);

      await this.logService.saveLog({
        modelId: model.id as any,
        modelCode: model.code,
        modelType,
        request: JSON.stringify({ audioLength: dto.audio.length, voice: dto.voice }),
        response: JSON.stringify({ format: result.format, text: result.text }),
        costMs: this.contextManager.calculateDuration(context),
        success: true,
        clientIp,
        userAgent,
        uid,
        appCode,
      });

      return {
        audioData: result.audioData,
        format: result.format,
        text: result.text,
        duration: result.duration,
      };
    } catch (error) {
      const model = await this.selectModel(dto.modelCode, modelType).catch(() => null);
      if (model) {
        await this.mcpService.reportError(model.id as any);
      }

      const normalized = this.errorHandler.normalize(error);
      throw new HttpException(
        `端到端语音失败: ${normalized.message}`,
        normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 构建包含历史的消息列表
   * @param conversation 会话信息
   * @param messages 当前消息
   * @returns {Promise<Array>} 合并后的消息列表
   */
  private async buildMessagesWithHistory(
    conversation: any,
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ role: string; content: string | Array<Record<string, unknown>> }>> {
    let conversationHistory: Array<{ role: string; content: string }> = [];

    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(
        conversation.id,
        20,
      );
      conversationHistory = historyMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    const combined = [...conversationHistory, ...messages];
    return this.preprocessMultimodalMessages(combined);
  }

  /**
   * 预处理消息列表，将 Markdown 图片转为结构化多模态内容
   * 支持两种格式的图片标记：
   *   - data:image/...;base64,... 数据 URL（直接使用）
   *   - http(s)://... 图片 URL（服务端下载后转为 Base64）
   * 确保多模态模型能正确解析图片内容，同时数据库只存储 URL 保持简洁
   * @param messages 原始消息列表
   * @returns 处理后的消息列表（包含结构化内容数组）
   */
  private async preprocessMultimodalMessages(
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ role: string; content: string | Array<Record<string, unknown>> }>> {
    const dataUrlRegex = /!\[([^\]]*)\]\(data:image\/([^;)]+);base64,([^)]+)\)/g;
    const httpImageRegex = /!\[([^\]]*)\]\(((?:http|https):\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|bmp|svg)(?:\?[^\s)]*)?)\)/gi;

    const results = await Promise.all(messages.map(async (msg) => {
      if (msg.role !== 'user') return msg;
      if (!msg.content) return msg;

      const dataUrlMatches = Array.from(msg.content.matchAll(dataUrlRegex));
      const httpImageMatches = Array.from(msg.content.matchAll(httpImageRegex));

      if (dataUrlMatches.length === 0 && httpImageMatches.length === 0) return msg;

      const allMatches: Array<{ index: number; match: RegExpMatchArray; type: 'dataurl' | 'http' }> = [
        ...dataUrlMatches.map((m) => ({ index: m.index!, match: m, type: 'dataurl' as const })),
        ...httpImageMatches.map((m) => ({ index: m.index!, match: m, type: 'http' as const })),
      ].sort((a, b) => a.index - b.index);

      const parts: Array<Record<string, unknown>> = [];
      let lastIndex = 0;

      for (const { index, match, type } of allMatches) {
        if (index > lastIndex) {
          parts.push({ type: 'text', text: msg.content.slice(lastIndex, index) });
        }

        if (type === 'dataurl') {
          const mimeType = `image/${match[2]}`;
          parts.push({
            type: 'image',
            image: `data:${mimeType};base64,${match[3]}`,
            mimeType,
          });
        } else {
          const imageUrl = match[2];
          try {
            const { default: axios } = await import('axios');
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            const contentType = response.headers['content-type'] || 'image/png';
            const base64 = Buffer.from(response.data).toString('base64');
            parts.push({
              type: 'image',
              image: `data:${contentType};base64,${base64}`,
              mimeType: contentType,
            });
          } catch {
            parts.push({ type: 'text', text: match[0] });
          }
        }

        lastIndex = index + match[0].length;
      }

      if (lastIndex < msg.content.length) {
        parts.push({ type: 'text', text: msg.content.slice(lastIndex) });
      }

      return { ...msg, content: parts };
    }));

    return results;
  }

  /**
   * 选择模型
   * @param modelCode 模型编码
   * @param modelType 模型类型
   * @param intent 对话意图（可选）
   * @returns {Promise<Model>} 模型信息
   */
  private async selectModel(modelCode?: string, modelType?: string, intent?: string): Promise<Model> {
    if (modelCode) {
      // 指定了模型，如果有意图则验证能力
      if (intent) {
        return this.mcpService.selectModelByIntent(
          modelType || 'llm',
          intent,
          modelCode,
        );
      }
      return this.modelService.findByCode(modelCode);
    }
    // MCP智能调度
    if (intent) {
      return this.mcpService.selectModelByIntent(modelType || 'llm', intent);
    }
    return this.mcpService.selectModel(modelType || 'llm');
  }

  /**
   * 处理调用错误
   * @param error 错误对象
   * @param context 执行上下文
   * @param dto 调用参数
   * @param modelType 模型类型
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户ID
   * @param appCode 应用编码
   * @returns {never}
   */
  private async handleInvokeError(
    error: unknown,
    context: ExecutionContext,
    dto: AiInvokeDto,
    modelType: string,
    clientIp: string,
    userAgent: string,
    uid?: string,
    appCode?: string,
  ): Promise<never> {
    const normalized = this.errorHandler.normalize(error);

    let modelId = 'unknown';
    let modelCode = 'unknown';

    try {
      const model = await this.selectModel(dto.modelCode, modelType);
      modelId = model.id as any;
      modelCode = model.code;
      await this.mcpService.reportError(model.id as any);
      await this.mcpService.releaseConcurrency(model.id as any);
    } catch {
      // 忽略模型选择失败
    }

    await this.logService.saveLog({
      modelId,
      modelCode,
      modelType,
      request: JSON.stringify(dto),
      response: normalized.message,
      costMs: this.contextManager.calculateDuration(context),
      success: false,
      clientIp,
      userAgent,
      errorMessage: normalized.message,
      uid,
      appCode,
    });

    throw new HttpException(
      `模型调用失败: ${normalized.message}`,
      normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * 执行 generateText（同步调用，供 Agent/Skill 使用）
   * @param params 调用参数
   * @returns 调用结果
   */
  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const context = this.contextManager.create({
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      uid: params.uid,
      appCode: params.appCode,
    });

    const result = await this.modelExecutor.executeWithConcurrency({
      model: params.model,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      options: {
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        toolChoice: params.toolChoice,
      },
      context,
    });

    if (params.onStepFinish && result.steps) {
      for (const step of result.steps) {
        params.onStepFinish(step);
      }
    }

    return this.toGenerateTextResult(result);
  }

  /**
   * 执行 streamText（流式调用，回调式，供 Agent 使用）
   * @param params 调用参数
   */
  async streamText(params: StreamTextParams): Promise<void> {
    const context = this.contextManager.create({
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      uid: params.uid,
      appCode: params.appCode,
    });

    const executionParams: ExecutionParams = {
      model: params.model,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      options: {
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        toolChoice: params.toolChoice,
        stream: true,
      },
      context,
    };

    let fullText = '';
    const toolCalls: ToolCall[] = [];
    let finishInfo: { reason: string; usage?: any } | undefined;
    let chunkBuffer = '';
    let concurrencyAcquired = false;

    try {
      await this.mcpService.checkCircuit(params.model.id as any);
      await this.mcpService.checkConcurrency(params.model.id as any);
      concurrencyAcquired = true;

      for await (const chunk of this.modelExecutor.stream(executionParams)) {
        switch (chunk.type) {
          case 'text-delta':
            if (chunk.delta && params.onChunk) {
              fullText += chunk.delta;

              const { safeText, newBuffer } = this.streamProcessor.processTextDelta(
                chunk.delta,
                chunkBuffer
              );
              chunkBuffer = newBuffer;

              if (safeText) {
                params.onChunk(safeText);
              }
            }
            break;

          case 'tool-call':
            if (chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
              this.logger.debug(`检测到工具调用: ${chunk.toolCall.toolName}`);
            }
            break;

          case 'finish':
            finishInfo = chunk.finish;
            break;

          case 'error':
            if (params.onError) {
              const errData = chunk.error;
              const error = errData instanceof Error ? errData : new Error(errData?.message || '未知错误');
              Object.assign(error, errData);
              params.onError(error);
            }
            return;
        }
      }

      if (chunkBuffer && params.onChunk) {
        const remaining = this.streamProcessor.processRemainingBuffer(chunkBuffer);
        if (remaining) {
          params.onChunk(remaining);
        }
      }

      await this.logService.logStreamResult(
        executionParams,
        fullText,
        finishInfo?.usage
      );

      if (finishInfo?.reason === 'tool-calls' && toolCalls.length > 0 && params.onToolCall) {
        for (const tc of toolCalls) {
          await params.onToolCall({ name: tc.toolName, args: tc.args });
        }
      } else if (finishInfo?.reason === 'stop' && params.onToolCall) {
        const textToolCall = this.toolCallParser.parseFromText(fullText);
        if (textToolCall) {
          this.logger.debug(`检测到文本格式工具调用: ${textToolCall.toolName}`);
          await params.onToolCall({ name: textToolCall.toolName, args: textToolCall.args });
        }
      }

      if (params.onFinish) {
        params.onFinish({
          text: fullText,
          finishReason: finishInfo?.reason,
          usage: finishInfo?.usage,
          toolCalls,
        });
      }

      await this.mcpService.reportSuccess(params.model.id as any);
    } catch (error) {
      await this.mcpService.reportError(params.model.id as any);
      if (params.onError) {
        params.onError(error);
      }
    } finally {
      if (concurrencyAcquired) {
        await this.mcpService.releaseConcurrency(params.model.id as any);
      }
    }
  }

  /**
   * 转换为 generateText 结果格式
   * @param result 执行结果
   * @returns generateText 结果
   */
  private toGenerateTextResult(result: ExecutionResult): GenerateTextResult {
    return {
      text: result.content,
      finishReason: result.finishReason,
      usage: result.usage,
      steps: result.steps,
      toolCalls: result.toolCalls,
    };
  }

  /**
   * 获取工具调用解析器（供外部使用）
   * @returns 工具调用解析器
   */
  getToolCallParser(): ToolCallParser {
    return this.toolCallParser;
  }

  /**
   * 根据模型类型获取对应的会话类型（所有模型对话统一使用 MODEL 类型）
   * @param _modelType 模型类型（llm/lmm/omni）
   * @returns 会话类型，始终返回 MODEL
   */
  private getConversationTypeByModelType(_modelType: string): ConversationType {
    return ConversationType.MODEL;
  }

}

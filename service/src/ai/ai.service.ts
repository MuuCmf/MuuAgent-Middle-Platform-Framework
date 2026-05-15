import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import { ModelService } from '../model/model.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import {
  AiInvokeDto,
  EmbeddingDto,
  ImageGenerateDto,
  TtsDto,
  AsrDto,
} from './dto/ai.dto';
import { Model } from '@prisma/client';
import { IsolationContext } from '../common/utils/isolation.util';
import { StrategyFactory } from './strategies/strategy.factory';
import { ModelExecutor } from './core/model.executor';
import { ContextManager } from './core/context.manager';
import { ErrorHandler, NormalizedError } from './handlers/error.handler';
import { LogService, LogData } from './infrastructure/log.service';
import { StreamProcessor } from './core/stream.processor';
import { ToolCallParser } from './parsers/tool-call.parser';
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
   * @param conversationService 会话服务
   * @param strategyFactory 策略工厂
   * @param modelExecutor 模型执行器
   * @param contextManager 上下文管理器
   * @param errorHandler 错误处理器
   * @param logService 日志服务
   * @param streamProcessor 流式处理器
   * @param toolCallParser 工具调用解析器
   */
  constructor(
    private mcpService: McpService,
    private modelService: ModelService,
    private conversationService: ConversationService,
    private strategyFactory: StrategyFactory,
    private modelExecutor: ModelExecutor,
    private contextManager: ContextManager,
    private errorHandler: ErrorHandler,
    private logService: LogService,
    private streamProcessor: StreamProcessor,
    private toolCallParser: ToolCallParser,
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
    const targetId = dto.modelCode || `mcp-${modelType}`;

    this.logger.debug(`AI调用开始: requestId=${context.requestId}, modelType=${modelType}, modelCode=${dto.modelCode}`);

    try {
      const isolationContext: IsolationContext = {
        appCode: appCode || null,
        isSuperAdmin: false,
      };

      const conversation = await this.conversationService.getOrCreate(
        ConversationType.MODEL,
        targetId,
        dto.conversationId,
        uid,
        isolationContext,
      );

      const messagesWithHistory = await this.buildMessagesWithHistory(
        conversation,
        dto.messages,
      );

      const lastUserMessage = dto.messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage) {
        await this.conversationService.addMessage(
          conversation.id as any,
          'user',
          lastUserMessage.content,
        );
      }

      const model = await this.selectModel(dto.modelCode, modelType);
      const provider = model.provider?.toLowerCase() || 'openai';

      await this.mcpService.checkCircuit(model.id as any);
      await this.mcpService.checkConcurrency(model.id as any);

      const executionParams: ExecutionParams = {
        model,
        messages: messagesWithHistory as any,
        options: {
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
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
    const targetId = dto.modelCode || `mcp-${modelType}`;

    this.logger.debug(`[Stream] 开始处理流式请求: requestId=${context.requestId}`);

    try {
      const isolationContext: IsolationContext = {
        appCode: appCode || null,
        isSuperAdmin: false,
      };

      const conversation = await this.conversationService.getOrCreate(
        ConversationType.MODEL,
        targetId,
        dto.conversationId,
        uid,
        isolationContext,
      );

      const messagesWithHistory = await this.buildMessagesWithHistory(
        conversation,
        dto.messages,
      );

      const lastUserMessage = dto.messages.filter((m) => m.role === 'user').pop();
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

      const model = await this.selectModel(dto.modelCode, modelType);
      modelId = model.id as any;

      await this.mcpService.checkCircuit(model.id as any);
      await this.mcpService.checkConcurrency(model.id as any);
      concurrencyAcquired = true;

      let accumulatedContent = '';
      const chunks: StreamChunk[] = [];

      const executionParams: ExecutionParams = {
        model,
        messages: messagesWithHistory as any,
        options: {
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        context,
      };

      for await (const chunk of this.modelExecutor.stream(executionParams)) {
        if (emitter.completed) {
          this.logger.debug(`[Stream] 流式传输被取消: requestId=${context.requestId}`);
          break;
        }

        chunks.push(chunk);

        if (chunk.type === 'text-delta' && chunk.delta) {
          accumulatedContent += chunk.delta;
          emitter.emitTextDelta(chunk.delta);
        } else if (chunk.type === 'tool-call' && chunk.toolCall) {
          emitter.emit(StreamEvents.toolCall(
            chunk.toolCall.toolName,
            chunk.toolCall.args as Record<string, unknown>,
          ));
        } else if (chunk.type === 'error' && chunk.error) {
          throw new Error(chunk.error.message);
        }
      }

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

      emitter.emitDone();
    } catch (error) {
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
      modelId: modelId || 'unknown',
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
      throw new HttpException(
        `图片生成失败: ${normalized.message}`,
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
  ): Promise<Array<{ role: string; content: string }>> {
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

    return [...conversationHistory, ...messages];
  }

  /**
   * 选择模型
   * @param modelCode 模型编码
   * @param modelType 模型类型
   * @returns {Promise<Model>} 模型信息
   */
  private async selectModel(modelCode?: string, modelType?: string): Promise<Model> {
    if (modelCode) {
      return this.modelService.findByCode(modelCode);
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

    await this.mcpService.reportError(modelId);

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
              params.onError(new Error(chunk.error?.message || '未知错误'));
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

}

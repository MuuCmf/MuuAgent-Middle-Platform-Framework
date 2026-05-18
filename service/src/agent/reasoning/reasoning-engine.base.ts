import { Logger } from '@nestjs/common';
import { ReasoningMode } from '../react/react.types';
import { IReasoningEngine, ReasoningResult, ReasoningStep } from './reasoning-engine.interface';
import { ExecutionContext } from '../execution/execution-context';
import { StreamEmitter, StreamEvents } from '../../stream';
import { AiService } from '../../ai/ai.service';
import { ConversationService } from '../../conversation/conversation.service';
import { ToolExecutor } from '../tools/tool-executor';
import { ToolNameSanitizer } from '../../ai/providers/tool-name-sanitizer';
import { parseAiError, getErrorCode } from '../../ai/utils/error-parser';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { WorkspaceToolHandler } from '../../workspace/workspace-tool.handler';
import type { ModelMessage } from 'ai';

/**
 * 工具执行结果接口
 */
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  costMs: number;
}

/**
 * 工具调用信息接口
 */
export interface ToolCallInfo {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * 推理引擎抽象基类
 * 
 * 提供所有推理引擎的公共功能：
 * - 消息构建
 * - 工具名称适配
 * - 工具执行（包括Workspace工具）
 * - 日志保存
 * - 错误处理
 * - 流式响应完成处理
 */
export abstract class BaseReasoningEngine implements IReasoningEngine {
  abstract readonly mode: ReasoningMode;
  protected readonly logger: Logger;

  constructor(
    protected readonly aiService: AiService,
    protected readonly conversationService: ConversationService,
    protected readonly toolExecutor: ToolExecutor,
    protected readonly prisma: PrismaService,
    protected readonly workspaceToolHandler: WorkspaceToolHandler,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 同步执行方法（子类实现）
   */
  abstract executeSync(context: ExecutionContext): Promise<ReasoningResult>;

  /**
   * 流式执行方法（子类实现）
   */
  abstract executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void>;

  /**
   * 构建消息列表
   * @param context 执行上下文
   * @returns 消息列表
   */
  protected buildMessages(context: ExecutionContext): ModelMessage[] {
    return [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];
  }

  /**
   * 适配工具名称
   * @param context 执行上下文
   * @returns 适配后的工具和名称映射
   */
  protected adaptTools(context: ExecutionContext): {
    tools: Record<string, any>;
    nameMap: Record<string, string>;
  } {
    return ToolNameSanitizer.adapt(context.tools, context.model?.provider);
  }

  /**
   * 保存用户消息到会话
   * @param context 执行上下文
   */
  protected async saveUserMessage(context: ExecutionContext): Promise<void> {
    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }
  }

  /**
   * 保存助手消息到会话
   * @param context 执行上下文
   * @param content 消息内容
   */
  protected async saveAssistantMessage(context: ExecutionContext, content: string): Promise<void> {
    await this.conversationService.addMessage(
      context.conversationId,
      'assistant',
      content,
    );
  }

  /**
   * 如果是首次对话，生成会话标题
   * @param context 执行上下文
   */
  protected async generateTitleIfNeeded(context: ExecutionContext): Promise<void> {
    if (context.conversationHistory.length === 0) {
      await this.conversationService.generateTitle(context.conversationId);
    }
  }

  /**
   * 执行工具调用
   * 支持普通工具和Workspace工具
   * 
   * @param toolCall 工具调用信息
   * @param context 执行上下文
   * @param emitter 可选的流式发射器（用于Workspace工具）
   * @returns 工具执行结果
   */
  protected async executeTool(
    toolCall: ToolCallInfo,
    context: ExecutionContext,
    emitter?: StreamEmitter,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const toolName = toolCall.name;

    try {
      let result: unknown;

      if (WORKSPACE_TOOL_NAMES.has(toolName)) {
        result = await this.executeWorkspaceTool(toolCall, emitter);
      } else {
        result = await this.executeNormalTool(toolCall, context);
      }

      return {
        toolCallId: toolCall.id || `tc_${Date.now()}`,
        toolName,
        args: toolCall.args,
        result,
        success: true,
        costMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '工具执行失败';
      this.logger.error(`工具执行失败 [${toolName}]: ${errorMsg}`);

      return {
        toolCallId: toolCall.id || `tc_${Date.now()}`,
        toolName,
        args: toolCall.args,
        result: null,
        success: false,
        error: errorMsg,
        costMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行Workspace工具
   */
  private async executeWorkspaceTool(
    toolCall: ToolCallInfo,
    emitter?: StreamEmitter,
  ): Promise<unknown> {
    if (!emitter) {
      throw new Error('Workspace工具需要流式发射器');
    }

    const workspaceResult = await this.workspaceToolHandler.dispatchToClient(
      emitter,
      toolCall.name,
      toolCall.args,
    );

    if (!workspaceResult.success) {
      throw new Error(workspaceResult.error || '客户端执行失败');
    }

    return workspaceResult.result;
  }

  /**
   * 执行普通工具
   */
  private async executeNormalTool(
    toolCall: ToolCallInfo,
    context: ExecutionContext,
  ): Promise<unknown> {
    const toolResult = await this.toolExecutor.executeToolCall(
      {
        id: toolCall.id || `tc_${Date.now()}`,
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.args),
        },
      },
      {
        agent: context.agent,
        conversationId: context.conversationId,
        uid: context.uid,
        isolationContext: context.isolationContext,
      },
    );

    if (!toolResult.success) {
      throw new Error(toolResult.error || '工具执行失败');
    }

    return toolResult.result;
  }

  /**
   * 格式化工具结果为文本
   * @param result 工具执行结果
   * @returns 格式化后的文本
   */
  protected formatToolResult(result: unknown): string {
    if (typeof result === 'object' && result !== null) {
      return JSON.stringify(result, null, 2);
    }
    return String(result ?? '');
  }

  /**
   * 创建推理步骤
   */
  protected createStep(
    stepNumber: number,
    stepType: ReasoningStep['stepType'],
    content: string,
    extras?: Partial<ReasoningStep>,
  ): ReasoningStep {
    return {
      stepNumber,
      stepType,
      content,
      ...extras,
    };
  }

  /**
   * 保存执行日志
   * @param context 执行上下文
   * @param result 执行结果
   * @param steps 推理步骤
   */
  protected async saveLog(
    context: ExecutionContext,
    result: { response: string; steps: ReasoningStep[] },
  ): Promise<void> {
    try {
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: context.agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: result.response,
          steps: JSON.stringify(result.steps),
          totalCostMs: context.totalCostMs,
          success: true,
          clientIp: context.clientIp,
          uid: context.uid,
          reasoningMode: this.mode,
          appCode: context.appCode,
        },
      });
    } catch (e) {
      this.logger.error('保存日志失败:', e);
    }
  }

  /**
   * 保存错误日志
   * @param context 执行上下文
   * @param errorMsg 错误信息
   * @param steps 已执行的步骤
   */
  protected async saveErrorLog(
    context: ExecutionContext,
    errorMsg: string,
    steps: ReasoningStep[] = [],
  ): Promise<void> {
    try {
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: context.agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: errorMsg,
          steps: JSON.stringify(steps),
          totalCostMs: context.totalCostMs,
          success: false,
          errorMessage: errorMsg,
          clientIp: context.clientIp,
          uid: context.uid,
          reasoningMode: this.mode,
          appCode: context.appCode,
        },
      });
    } catch (e) {
      this.logger.error('保存错误日志失败:', e);
    }
  }

  /**
   * 处理错误并返回错误结果
   * @param error 错误对象
   * @param context 执行上下文
   * @param steps 已执行的步骤
   * @returns 推理结果
   */
  protected handleError(
    error: unknown,
    context: ExecutionContext,
    steps: ReasoningStep[] = [],
  ): ReasoningResult {
    const errorMsg = parseAiError(error);
    this.logger.error(`[${this.mode}] 执行失败: ${errorMsg}`);

    this.saveErrorLog(context, errorMsg, steps).catch(e => {
      this.logger.error('保存错误日志失败:', e);
    });

    return {
      response: errorMsg,
      steps,
    };
  }

  /**
   * 完成流式响应
   * @param context 执行上下文
   * @param emitter 流式发射器
   * @param finalResponse 最终响应
   * @param steps 推理步骤
   */
  protected async finalizeStreamResponse(
    context: ExecutionContext,
    emitter: StreamEmitter,
    finalResponse: string,
    steps: ReasoningStep[],
  ): Promise<void> {
    await this.saveAssistantMessage(context, finalResponse);
    await this.generateTitleIfNeeded(context);
    await this.saveLog(context, { response: finalResponse, steps });

    emitter.emitDone({
      conversationId: context.conversationId,
      response: finalResponse,
      totalCostMs: context.totalCostMs,
    });

    this.logger.log(`[${this.mode}] 执行完成, 耗时: ${context.totalCostMs}ms`);
  }

  /**
   * 发射流式错误
   * @param error 错误对象
   * @param emitter 流式发射器
   */
  protected emitStreamError(error: unknown, emitter: StreamEmitter): void {
    const errorMsg = parseAiError(error);
    const errorCode = getErrorCode(error);
    this.logger.error(`[${this.mode}] 流式执行失败: ${errorMsg}`);
    emitter.emitError(errorMsg, errorCode);
  }

  /**
   * 发射推理步骤事件
   * @param emitter 流式发射器
   * @param step 推理步骤
   */
  protected emitReasoningStep(emitter: StreamEmitter, step: ReasoningStep): void {
    emitter.emit(StreamEvents.reasoningStep(step));
  }

  /**
   * 发射工具调用事件
   * @param emitter 流式发射器
   * @param toolName 工具名称
   * @param args 工具参数
   * @param result 工具结果
   */
  protected emitToolCall(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
  ): void {
    emitter.emit(StreamEvents.toolCall(toolName, args, result));
  }

}

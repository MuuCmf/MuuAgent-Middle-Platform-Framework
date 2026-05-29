import { Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { ReasoningMode, IReasoningEngine, ReasoningResult, ReasoningStep } from './types';
import { ExecutionContext } from '../agent/execution/execution-context';
import { StreamEmitter, StreamEvents } from '../stream';
import { AiService } from '../ai/ai.service';
import { TtsStreamService } from '../ai/tts-stream.service';
import { ConversationService } from '../conversation/conversation.service';
import { ToolExecutor } from '../agent/tools/tool-executor';
import { ToolNameSanitizer } from '../ai/providers/tool-name-sanitizer';
import { parseAiError, getErrorCode } from '../ai/utils/error-parser';
import { PrismaService } from '../common/prisma/prisma.service';
import { ClientToolRegistry, ClientToolEntry } from '../client-tool';
import { ThinkingTagParser, ThinkingSegment } from './thinking-tag-parser';
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
 * 使用模板方法模式：子类（React/Plan/Reflect）通过覆写 hook 方法
 * 来定制行为，核心循环逻辑由基类的 executeSyncLoop/executeStreamLoop 统一管理。
 *
 * Hook 覆写点：
 * - beforeSyncLoop / beforeStreamLoop        → Plan 生成计划
 * - afterSyncToolExecution / afterStreamToolExecution → Reflect 反思
 * - pushSyncToolMessages                     → React 使用结构化 tool-call 消息
 * - buildToolResultPrompt                     → React 使用不同的提示词
 */
export abstract class BaseReasoningEngine implements IReasoningEngine {
  abstract readonly mode: ReasoningMode;
  protected readonly logger: Logger;

  constructor(
    protected readonly aiService: AiService,
    protected readonly conversationService: ConversationService,
    protected readonly toolExecutor: ToolExecutor,
    protected readonly prisma: PrismaService,
    protected readonly clientToolRegistry: ClientToolRegistry,
    @Optional()
    @Inject(forwardRef(() => TtsStreamService))
    protected readonly ttsStreamService?: TtsStreamService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract executeSync(context: ExecutionContext): Promise<ReasoningResult>;
  abstract executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void>;

  // ================================================================
  // 模板方法：同步执行循环
  // ================================================================

  protected async executeSyncLoop(context: ExecutionContext): Promise<ReasoningResult> {
    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      await this.beforeSyncLoop(context, messages, steps);

      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[${this.mode}] Step ${i + 1}/${context.maxSteps}`);

        const result = await this.aiService.generateText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp: context.clientIp,
          userAgent: 'agent-service',
          uid: context.uid,
          appCode: context.appCode,
        });

        const stepText = result.text;

        if (result.toolCalls && result.toolCalls.length > 0) {
          steps.push(this.createStep(steps.length + 1, 'thought', stepText || '需要调用工具'));

          for (const toolCall of result.toolCalls) {
            const resolvedName = nameMap[toolCall.toolName] || toolCall.toolName;
            const toolResult = await this.executeTool(
              { id: toolCall.toolCallId, name: resolvedName, args: toolCall.args },
              context,
            );

            steps.push(this.createStep(
              steps.length + 1, 'action',
              `调用工具: ${resolvedName}`,
              { action: resolvedName, actionInput: toolCall.args },
            ));

            const resultText = toolResult.success
              ? this.formatToolResult(toolResult.result)
              : `工具执行失败: ${toolResult.error || '未知错误'}`;
            steps.push(this.createStep(steps.length + 1, 'observation', resultText, { observation: resultText }));

            this.pushSyncToolMessages(messages, stepText, toolCall, resultText);
            await this.afterSyncToolExecution(context, messages, steps, i);
          }
        } else {
          finalResponse = stepText.trim();
          steps.push(this.createStep(steps.length + 1, 'final_answer', finalResponse));
          break;
        }
      }

      await this.saveAssistantMessage(context, finalResponse);
      await this.generateTitleIfNeeded(context);
      await this.saveLog(context, { response: finalResponse, steps });

      return { response: finalResponse, steps };
    } catch (error) {
      return this.handleError(error, context, steps);
    }
  }

  // ================================================================
  // 模板方法：流式执行循环
  // ================================================================

  protected async executeStreamLoop(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    // ========== TTS 实时合成状态 ==========
    let sentenceBuffer = '';
    let ttsInitialized = false;
    const conversationId = context.conversationId;
    const isTtsActive = (): boolean =>
      this.ttsStreamService?.isSessionActive(conversationId) ?? false;

    try {
      await this.beforeStreamLoop(context, messages, steps, emitter);

      let blockIndex = 0;

      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[${this.mode} Stream] Step ${i + 1}/${context.maxSteps}`);

        let stepText = '';
        let hasToolCall = false;
        let textBlockOpened = false;
        let thinkingBlockOpened = false;
        const parser = new ThinkingTagParser();

        /**
         * 将解析器产生的段应用到 SSE 发射器
         * @param segments 解析出的段列表
         */
        const applySegments = (segments: ThinkingSegment[]): void => {
          for (const seg of segments) {
            switch (seg.type) {
              case 'begin_thinking':
                if (textBlockOpened) {
                  emitter.emitContentBlockStop('text', blockIndex - 1);
                  textBlockOpened = false;
                }
                emitter.emitContentBlockStart('thinking', blockIndex);
                blockIndex++;
                thinkingBlockOpened = true;
                break;
              case 'end_thinking':
                if (thinkingBlockOpened) {
                  emitter.emitContentBlockStop('thinking', blockIndex - 1);
                  thinkingBlockOpened = false;
                }
                break;
              case 'text_delta':
                if (thinkingBlockOpened) {
                  emitter.emitTextDelta(seg.content ?? '');
                } else {
                  if (!textBlockOpened) {
                    emitter.emitContentBlockStart('text', blockIndex);
                    blockIndex++;
                    textBlockOpened = true;
                  }
                  emitter.emitTextDelta(seg.content ?? '');
                }
                break;
            }
          }
        };

        await this.aiService.streamText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp: context.clientIp,
          userAgent: 'agent-service',
          uid: context.uid,
          appCode: context.appCode,
          onChunk: (chunk) => {
            stepText += chunk;
            applySegments(parser.process(chunk));

            // 实时句子检测并触发 TTS
            if (ttsEnabled) {
              sentenceBuffer += chunk;
              if (
                sentenceBuffer.length >= 10 &&
                /[。！？.!?\n……]$/.test(sentenceBuffer)
              ) {
                if (!ttsInitialized) {
                  this.ttsStreamService!.initTtsSession(
                    conversationId,
                    context.appCode,
                  ).then((ok) => { ttsInitialized = ok; });
                }
                const sentence = sentenceBuffer;
                sentenceBuffer = '';
                this.ttsStreamService!.synthesizeSentence(
                  sentence,
                  conversationId,
                  context.clientIp,
                  context.userAgent,
                  context.uid,
                  context.appCode,
                ).catch((err) =>
                  this.logger.warn(
                    `TTS 实时合成失败: ${(err as Error).message}`,
                  ),
                );
              }
            }
          },
          onToolCall: async (toolCall: { name: string; args: any }) => {
            applySegments(parser.flush());

            hasToolCall = true;
            const resolvedName = nameMap[toolCall.name] || toolCall.name;

            if (textBlockOpened) {
              emitter.emitContentBlockStop('text', blockIndex - 1);
              textBlockOpened = false;
            }
            if (thinkingBlockOpened) {
              emitter.emitContentBlockStop('thinking', blockIndex - 1);
              thinkingBlockOpened = false;
            }

            emitter.emitContentBlockStart('tool_call', blockIndex, resolvedName);
            blockIndex++;
            await this.handleStreamToolCall(
              context, messages, steps, emitter,
              stepText, resolvedName, toolCall.args, i,
            );
            emitter.emitContentBlockStop('tool_call', blockIndex - 1);
            blockIndex++;

            parser.reset();
          },
        });

        if (!hasToolCall) {
          applySegments(parser.flush());

          if (thinkingBlockOpened) {
            emitter.emitContentBlockStop('thinking', blockIndex - 1);
            thinkingBlockOpened = false;
          }
          if (textBlockOpened) {
            emitter.emitContentBlockStop('text', blockIndex - 1);
            textBlockOpened = false;
          }

          finalResponse = stepText.trim();
          const finalStep = this.createStep(steps.length + 1, 'final_answer', finalResponse);
          steps.push(finalStep);
          this.emitReasoningStep(emitter, finalStep);
          break;
        }
      }

      await this.finalizeStreamResponse(context, emitter, finalResponse, steps, ttsEnabled);
    } catch (error) {
      // TTS：发生错误时刷新剩余 buffer
      if (ttsEnabled && sentenceBuffer.trim()) {
        this.ttsStreamService!.synthesizeSentence(
          sentenceBuffer.trim(),
          conversationId,
          context.clientIp,
          context.userAgent,
          context.uid,
          context.appCode,
        ).catch(() => {});
      }
      this.ttsStreamService?.finalizeTtsSession(conversationId);
      this.emitStreamError(error, emitter);
    }
  }

  // ================================================================
  // 统一流式工具调用处理
  // ================================================================

  protected async handleStreamToolCall(
    context: ExecutionContext,
    messages: ModelMessage[],
    steps: ReasoningStep[],
    emitter: StreamEmitter,
    stepText: string,
    toolName: string,
    args: Record<string, unknown>,
    stepIndex: number,
  ): Promise<void> {
    const thoughtStep = this.createStep(steps.length + 1, 'thought', stepText || `需要调用工具 ${toolName}`);
    steps.push(thoughtStep);
    this.emitReasoningStep(emitter, thoughtStep);

    const actionStep = this.createStep(steps.length + 1, 'action', `调用工具: ${toolName}`, { action: toolName, actionInput: args });
    steps.push(actionStep);
    this.emitReasoningStep(emitter, actionStep);

    const toolResult = await this.executeTool({ name: toolName, args }, context, emitter);
    this.emitToolCall(emitter, toolName, args, toolResult.result);

    const resultText = toolResult.success
      ? this.formatToolResult(toolResult.result)
      : `工具执行失败: ${toolResult.error || '未知错误'}`;

    const observationStep = this.createStep(steps.length + 1, 'observation', resultText, { observation: resultText });
    steps.push(observationStep);
    this.emitReasoningStep(emitter, observationStep);

    messages.push({ role: 'assistant', content: stepText });
    messages.push({
      role: 'user',
      content: this.buildToolResultPrompt(toolName, resultText, toolResult.success),
    });

    await this.afterStreamToolExecution(context, messages, steps, emitter, stepIndex);
  }

  // ================================================================
  // Hook：子类覆写以下方法以定制行为
  // ================================================================

  protected async beforeSyncLoop(
    _context: ExecutionContext, _messages: ModelMessage[], _steps: ReasoningStep[],
  ): Promise<void> {}

  protected async afterSyncToolExecution(
    _context: ExecutionContext, _messages: ModelMessage[], _steps: ReasoningStep[], _stepIndex: number,
  ): Promise<void> {}

  protected async beforeStreamLoop(
    _context: ExecutionContext, _messages: ModelMessage[], _steps: ReasoningStep[], _emitter: StreamEmitter,
  ): Promise<void> {}

  protected async afterStreamToolExecution(
    _context: ExecutionContext, _messages: ModelMessage[], _steps: ReasoningStep[], _emitter: StreamEmitter, _stepIndex: number,
  ): Promise<void> {}

  protected pushSyncToolMessages(
    messages: ModelMessage[],
    stepText: string,
    toolCall: { toolCallId?: string; toolName: string; args: Record<string, unknown> },
    resultText: string,
  ): void {
    messages.push({ role: 'assistant', content: stepText });
    messages.push({
      role: 'tool',
      content: [{
        type: 'tool-result',
        toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
        toolName: toolCall.toolName,
        result: resultText,
      }],
    } as any);
  }

  protected buildToolResultPrompt(toolName: string, resultText: string, success: boolean = true): string {
    if (success) {
      return `工具 ${toolName} 执行成功，返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。`;
    }
    return `工具 ${toolName} 执行失败: ${resultText}\n\n此工具不可用，请不要再次调用该工具，请直接告知用户该工具无法使用，或尝试其他方式回答用户问题。`;
  }

  // ================================================================
  // 公共工具方法
  // ================================================================

  protected buildMessages(context: ExecutionContext): ModelMessage[] {
    return [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];
  }

  protected adaptTools(context: ExecutionContext): {
    tools: Record<string, any>;
    nameMap: Record<string, string>;
  } {
    return ToolNameSanitizer.adapt(context.tools, context.model?.provider);
  }

  protected async saveUserMessage(context: ExecutionContext): Promise<void> {
    try {
      await this.conversationService.addMessage(context.conversationId, 'user', context.userMessage);
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }
  }

  protected async saveAssistantMessage(context: ExecutionContext, content: string): Promise<void> {
    await this.conversationService.addMessage(context.conversationId, 'assistant', content);
  }

  protected async generateTitleIfNeeded(context: ExecutionContext): Promise<void> {
    if (context.conversationHistory.length === 0) {
      await this.conversationService.generateTitle(context.conversationId);
    }
  }

  protected async executeTool(
    toolCall: ToolCallInfo,
    context: ExecutionContext,
    emitter?: StreamEmitter,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const toolName = toolCall.name;

    try {
      let result: unknown;

      const entry = this.clientToolRegistry.getEntryByToolName(toolName);
      if (entry) {
        result = await this.executeClientTool(entry, toolCall, emitter);
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
   * 执行客户端工具（通用）
   * @param entry 注册条目
   * @param toolCall 工具调用信息
   * @param emitter SSE发射器
   */
  private async executeClientTool(entry: ClientToolEntry, toolCall: ToolCallInfo, emitter?: StreamEmitter): Promise<unknown> {
    if (!emitter) {
      throw new Error(`客户端工具 ${toolCall.name} 需要流式发射器`);
    }
    const clientResult = await entry.handler.dispatchToClient(
      emitter, toolCall.name, toolCall.args,
    );
    if (!clientResult.success) {
      throw new Error(clientResult.error || '客户端执行失败');
    }
    return clientResult.result;
  }

  private async executeNormalTool(toolCall: ToolCallInfo, context: ExecutionContext): Promise<unknown> {
    const toolResult = await this.toolExecutor.executeToolCall(
      {
        id: toolCall.id || `tc_${Date.now()}`,
        function: { name: toolCall.name, arguments: JSON.stringify(toolCall.args) },
      },
      {
        agent: context.agent,
        conversationId: context.conversationId,
        uid: context.uid,
        isolationContext: context.isolationContext,
        clientIp: context.clientIp,
      },
    );
    if (!toolResult.success) {
      throw new Error(toolResult.error || '工具执行失败');
    }
    return toolResult.result;
  }

  protected formatToolResult(result: unknown): string {
    if (typeof result === 'object' && result !== null) {
      return JSON.stringify(result, null, 2);
    }
    return String(result ?? '');
  }

  protected createStep(
    stepNumber: number,
    stepType: ReasoningStep['stepType'],
    content: string,
    extras?: Partial<ReasoningStep>,
  ): ReasoningStep {
    return { stepNumber, stepType, content, ...extras };
  }

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
    return { response: errorMsg, steps };
  }

  protected async finalizeStreamResponse(
    context: ExecutionContext,
    emitter: StreamEmitter,
    finalResponse: string,
    steps: ReasoningStep[],
    flushTts?: boolean,
  ): Promise<void> {
    // 刷新 TTS 剩余 buffer
    if (flushTts && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep?.content && this.ttsStreamService) {
        const conversationId = context.conversationId;
        if (this.ttsStreamService.isSessionActive(conversationId)) {
          this.ttsStreamService.synthesizeSentence(
            lastStep.content,
            conversationId,
            context.clientIp,
            context.userAgent,
            context.uid,
            context.appCode,
          ).catch(() => {});
          this.ttsStreamService.finalizeTtsSession(conversationId);
        }
      }
    }

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

  protected emitStreamError(error: unknown, emitter: StreamEmitter): void {
    const errorMsg = parseAiError(error);
    const errorCode = getErrorCode(error);
    this.logger.error(`[${this.mode}] 流式执行失败: ${errorMsg}`);
    emitter.emitError(errorMsg, errorCode);
  }

  protected emitReasoningStep(emitter: StreamEmitter, step: ReasoningStep): void {
    emitter.emit(StreamEvents.reasoningStep(step));
  }

  protected emitToolCall(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
  ): void {
    emitter.emit(StreamEvents.toolCall(toolName, args, result));
  }
}

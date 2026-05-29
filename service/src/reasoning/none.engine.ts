import { Injectable, Inject, Optional, forwardRef } from '@nestjs/common';
import { ReasoningMode, ReasoningResult } from './types';
import { ExecutionContext } from '../agent/execution/execution-context';
import { StreamEmitter } from '../stream';
import { AiService } from '../ai/ai.service';
import { TtsStreamService } from '../ai/tts-stream.service';
import { ConversationService } from '../conversation/conversation.service';
import { ToolExecutor } from '../agent/tools/tool-executor';
import { PrismaService } from '../common/prisma/prisma.service';
import { ClientToolRegistry } from '../client-tool';
import { BaseReasoningEngine, ToolCallInfo } from './base.engine';
import type { ModelMessage } from 'ai';

@Injectable()
export class NoneReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.NONE;

  private readonly maxToolCalls = 3;

  constructor(
    aiService: AiService,
    conversationService: ConversationService,
    toolExecutor: ToolExecutor,
    prisma: PrismaService,
    clientToolRegistry: ClientToolRegistry,
    @Optional()
    @Inject(forwardRef(() => TtsStreamService))
    ttsStreamService?: TtsStreamService,
  ) {
    super(aiService, conversationService, toolExecutor, prisma, clientToolRegistry, ttsStreamService);
  }

  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);

    await this.saveUserMessage(context);

    try {
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

      await this.saveAssistantMessage(context, result.text);
      await this.generateTitleIfNeeded(context);
      await this.saveLog(context, { response: result.text, steps: [] });

      return {
        response: result.text,
        steps: [],
        toolCalls: (result.toolCalls || []).map((tc: any) => ({
          ...tc,
          toolName: nameMap[tc.toolName] || tc.toolName,
        })),
      };
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);

    await this.saveUserMessage(context);

    await this.executeStreamInternal(context, messages, emitter, tools, nameMap, 0);
  }

  private async executeStreamInternal(
    context: ExecutionContext,
    currentMessages: ModelMessage[],
    emitter: StreamEmitter,
    tools: Record<string, any>,
    nameMap: Record<string, string>,
    toolCallCount: number,
  ): Promise<void> {
    try {
      let toolCallToExecute: ToolCallInfo | null = null;
      let blockIndex = toolCallCount * 2;
      let textBlockOpened = false;

      const openTextBlock = () => {
        if (!textBlockOpened) {
          emitter.emitContentBlockStart('text', blockIndex);
          textBlockOpened = true;
        }
      };

      const closeTextBlock = () => {
        if (textBlockOpened) {
          emitter.emitContentBlockStop('text', blockIndex);
          blockIndex++;
          textBlockOpened = false;
        }
      };

      await this.aiService.streamText({
        model: context.model,
        system: context.systemPrompt,
        messages: currentMessages,
        tools,
        temperature: context.temperature,
        clientIp: context.clientIp,
        userAgent: 'agent-service',
        uid: context.uid,
        appCode: context.appCode,
        onChunk: (chunk) => {
          openTextBlock();
          emitter.emitTextDelta(chunk);
        },
        onToolCall: (toolCall) => {
          closeTextBlock();
          toolCallToExecute = toolCall;
        },
        onFinish: async (result) => {
          const isFunctionCallText = this.aiService.getToolCallParser().containsFunctionCallMarkers(result.text || '');
          const hasToolCall = toolCallToExecute || isFunctionCallText;

          if (hasToolCall && toolCallCount < this.maxToolCalls) {
            const parsedToolCall = this.aiService.getToolCallParser().parseFromText(result.text || '');
            const rawCall = toolCallToExecute || (parsedToolCall ? { name: parsedToolCall.toolName, args: parsedToolCall.args } : null);

            if (rawCall) {
              closeTextBlock();
              const resolvedName = nameMap[rawCall.name] || rawCall.name;
              emitter.emitContentBlockStart('tool_call', blockIndex, resolvedName);
              blockIndex++;

              await this.handleToolCallInStream(
                context, currentMessages, emitter, tools, nameMap, toolCallCount, rawCall,
              );

              return;
            }
          }

          closeTextBlock();
          await this.handleStreamFinish(context, emitter, result);
        },
        onError: (error) => {
          closeTextBlock();
          this.emitStreamError(error, emitter);
        },
      });
    } catch (error) {
      this.emitStreamError(error, emitter);
    }
  }

  private async handleToolCallInStream(
    context: ExecutionContext,
    currentMessages: ModelMessage[],
    emitter: StreamEmitter,
    tools: Record<string, any>,
    nameMap: Record<string, string>,
    toolCallCount: number,
    rawCall: ToolCallInfo,
  ): Promise<void> {
    const resolvedName = nameMap[rawCall.name] || rawCall.name;
    const toolCall: ToolCallInfo = { ...rawCall, name: resolvedName };
    const toolBlockIndex = toolCallCount * 2 + 1;

    try {
      const toolResult = await this.executeTool(toolCall, context, emitter);

      this.emitToolCall(emitter, toolCall.name, toolCall.args, toolResult.result);
      emitter.emitContentBlockStop('tool_call', toolBlockIndex);

      const resultText = this.formatToolResult(toolResult.result);

      const stepBase = toolCallCount * 3;
      const thoughtStep = this.createStep(stepBase + 1, 'thought', `需要调用工具 ${resolvedName}`);
      this.emitReasoningStep(emitter, thoughtStep);

      const actionStep = this.createStep(stepBase + 2, 'action', `调用工具: ${resolvedName}`, { action: resolvedName, actionInput: toolCall.args });
      this.emitReasoningStep(emitter, actionStep);

      const observationStep = this.createStep(stepBase + 3, 'observation', resultText, { observation: resultText });
      this.emitReasoningStep(emitter, observationStep);

      const newMessages: ModelMessage[] = [
        ...currentMessages,
        {
          role: 'assistant',
          content: `Action: ${rawCall.name}\nAction Input: ${JSON.stringify(toolCall.args)}\nObservation: ${resultText}`,
        },
        {
          role: 'user',
          content: `请基于工具返回结果用自然语言回答用户问题。工具返回: ${resultText}`,
        },
      ];

      await this.executeStreamInternal(context, newMessages, emitter, tools, nameMap, toolCallCount + 1);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '工具执行失败';
      this.logger.error(`工具执行失败: ${errorMsg}`);

      this.emitToolCall(emitter, toolCall.name, toolCall.args, `工具执行失败: ${errorMsg}`);
      emitter.emitContentBlockStop('tool_call', toolBlockIndex);

      const errorStep = this.createStep(3, 'observation', `工具执行失败: ${errorMsg}`, { observation: errorMsg });
      this.emitReasoningStep(emitter, errorStep);

      await this.saveLog(context, { response: `抱歉，工具执行失败: ${errorMsg}`, steps: [] });
      emitter.emitDone({
        conversationId: context.conversationId,
        response: `抱歉，工具执行失败: ${errorMsg}`,
        totalCostMs: context.totalCostMs,
      });
    }
  }

  private async handleStreamFinish(
    context: ExecutionContext,
    emitter: StreamEmitter,
    result: { text?: string },
  ): Promise<void> {
    if (result.text && result.text.length > 0) {
      const cleanText = this.aiService.getToolCallParser().stripFunctionCallMarkers(result.text);

      if (cleanText) {
        await this.saveAssistantMessage(context, cleanText);
      }

      await this.generateTitleIfNeeded(context);
      await this.saveLog(context, { response: cleanText || result.text || '', steps: [] });
      emitter.emitDone({
        conversationId: context.conversationId,
        response: cleanText || '',
        totalCostMs: context.totalCostMs,
      });
    } else {
      const finalResponse = result.text || '抱歉，我无法回答您的问题。';

      await this.saveAssistantMessage(context, finalResponse);
      await this.generateTitleIfNeeded(context);
      await this.saveLog(context, { response: finalResponse, steps: [] });
      emitter.emitDone({
        conversationId: context.conversationId,
        response: finalResponse,
        totalCostMs: context.totalCostMs,
      });
    }
  }
}

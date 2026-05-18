import { Injectable, Logger } from '@nestjs/common';
import { ReasoningMode } from '../react/react.types';
import { IReasoningEngine, ReasoningResult } from './reasoning-engine.interface';
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

@Injectable()
export class NoneReasoningEngine implements IReasoningEngine {
  readonly mode = ReasoningMode.NONE;
  private readonly logger = new Logger(NoneReasoningEngine.name);

  constructor(
    private readonly aiService: AiService,
    private readonly conversationService: ConversationService,
    private readonly toolExecutor: ToolExecutor,
    private readonly prisma: PrismaService,
    private readonly workspaceToolHandler: WorkspaceToolHandler,
  ) {}

  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }

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

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        result.text,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(context, { text: result.text });

      return {
        response: result.text,
        steps: [],
        toolCalls: (result.toolCalls || []).map((tc: any) => ({
          ...tc,
          toolName: nameMap[tc.toolName] || tc.toolName,
        })),
      };
    } catch (error) {
      const errorMsg = parseAiError(error);
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: context.agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: errorMsg,
          steps: '[]',
          totalCostMs: context.totalCostMs,
          success: false,
          errorMessage: errorMsg,
          clientIp: context.clientIp,
          uid: context.uid,
          reasoningMode: this.mode,
          appCode: context.appCode,
        },
      });

      return {
        response: errorMsg,
        steps: [],
      };
    }
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    const maxToolCalls = 3;

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }

    await this.executeStreamInternal(context, messages, emitter, tools, nameMap, maxToolCalls, 0);
  }

  private async executeStreamInternal(
    context: ExecutionContext,
    currentMessages: ModelMessage[],
    emitter: StreamEmitter,
    tools: Record<string, any>,
    nameMap: Record<string, string>,
    maxToolCalls: number,
    toolCallCount: number,
  ): Promise<void> {
    try {
      let toolCallToExecute: { name: string; args: any } | null = null;

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
          emitter.emitTextDelta(chunk);
        },
        onToolCall: (toolCall) => {
          toolCallToExecute = toolCall;
        },
        onFinish: async (result) => {
          const isFunctionCallText = this.aiService.getToolCallParser().containsFunctionCallMarkers(result.text || '');
          const hasToolCall = toolCallToExecute || isFunctionCallText;

          if (hasToolCall && toolCallCount < maxToolCalls) {
            const parsedToolCall = this.aiService.getToolCallParser().parseFromText(result.text || '');
            const rawCall = toolCallToExecute || (parsedToolCall ? { name: parsedToolCall.toolName, args: parsedToolCall.args } : null);

            if (rawCall) {
              const resolvedName = nameMap[rawCall.name] || rawCall.name;
              const toolCall = { ...rawCall, name: resolvedName };

              try {
                let toolResult: any;

                if (WORKSPACE_TOOL_NAMES.has(toolCall.name)) {
                  const workspaceResult = await this.workspaceToolHandler.dispatchToClient(
                    emitter,
                    toolCall.name,
                    toolCall.args,
                  );

                  if (workspaceResult.success) {
                    toolResult = {
                      toolCallId: `tc_${Date.now()}`,
                      toolName: toolCall.name,
                      args: toolCall.args,
                      result: workspaceResult.result,
                      success: true,
                      costMs: 0,
                    };
                  } else {
                    throw new Error(workspaceResult.error || '客户端执行失败');
                  }
                } else {
                  toolResult = await this.toolExecutor.executeToolCall(
                    {
                      id: `tc_${Date.now()}`,
                      function: {
                        name: toolCall.name,
                        arguments: JSON.stringify(toolCall.args),
                      },
                    },
                    { agent: context.agent, conversationId: context.conversationId, uid: context.uid, isolationContext: context.isolationContext },
                  );
                }

                emitter.emit(StreamEvents.toolCall(toolCall.name, toolCall.args, toolResult.result));

                const resultText = typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : String(toolResult.result);

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

                await this.executeStreamInternal(context, newMessages, emitter, tools, nameMap, maxToolCalls, toolCallCount + 1);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
                this.logger.error(`工具执行失败: ${errorMsg}`);

                emitter.emit(StreamEvents.toolCall(toolCall.name, toolCall.args, `工具执行失败: ${errorMsg}`));
                await this.saveLog(context, { text: `抱歉，工具执行失败: ${errorMsg}` });
                emitter.emitDone({
                  conversationId: context.conversationId,
                  response: `抱歉，工具执行失败: ${errorMsg}`,
                  totalCostMs: context.totalCostMs,
                });
              }
              return;
            }
          }

          if (result.text && result.text.length > 0) {
            const cleanText = this.aiService.getToolCallParser().stripFunctionCallMarkers(result.text);

            if (cleanText) {
              await this.conversationService.addMessage(
                context.conversationId,
                'assistant',
                cleanText,
              );
            }

            if (context.conversationHistory.length === 0) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(context, { text: cleanText || result.text });
            emitter.emitDone({
              conversationId: context.conversationId,
              response: cleanText || '',
              totalCostMs: context.totalCostMs,
            });
          } else {
            const finalResponse = result.text || '抱歉，我无法回答您的问题。';

            await this.conversationService.addMessage(
              context.conversationId,
              'assistant',
              finalResponse,
            );

            if (context.conversationHistory.length === 0) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(context, { text: finalResponse });
            emitter.emitDone({
              conversationId: context.conversationId,
              response: finalResponse,
              totalCostMs: context.totalCostMs,
            });
          }
        },
        onError: (error) => {
          const errorMsg = parseAiError(error);
          const errorCode = getErrorCode(error);
          emitter.emitError(errorMsg, errorCode);
        },
      });
    } catch (error) {
      const errorMsg = parseAiError(error);
      const errorCode = getErrorCode(error);
      emitter.emitError(errorMsg, errorCode);
    }
  }

  private async saveLog(context: ExecutionContext, result: { text: string }): Promise<void> {
    try {
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: context.agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: result.text,
          steps: '[]',
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
}
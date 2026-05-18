import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class PlanReasoningEngine implements IReasoningEngine {
  readonly mode = ReasoningMode.PLAN;
  private readonly logger = new Logger(PlanReasoningEngine.name);

  constructor(
    private readonly aiService: AiService,
    private readonly conversationService: ConversationService,
    private readonly toolExecutor: ToolExecutor,
    private readonly prisma: PrismaService,
    private readonly workspaceToolHandler: WorkspaceToolHandler,
  ) {}

  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[Plan] 开始执行同步模式`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      steps.push({
        stepNumber: 1,
        stepType: 'thought',
        content: '开始制定计划...',
      });

      const planPrompt = `
你是一个规划助手。请基于用户问题制定一个详细的执行计划。
用户问题: ${context.userMessage}

请按照以下格式输出计划：
1. 步骤1：描述第一个需要执行的操作
2. 步骤2：描述第二个需要执行的操作
...

计划应该包含解决问题所需的所有关键步骤。
      `.trim();

      const planResult = await this.aiService.generateText({
        model: context.model,
        system: '你是一个智能规划助手，擅长为复杂问题制定详细的执行计划。',
        messages: [{ role: 'user', content: planPrompt }],
        temperature: 0.3,
        clientIp: context.clientIp,
        userAgent: 'agent-service',
        uid: context.uid,
        appCode: context.appCode,
      });

      const planText = planResult.text;
      steps.push({
        stepNumber: 2,
        stepType: 'thought',
        content: `计划:\n${planText}`,
      });

      messages.push({
        role: 'assistant',
        content: `根据分析，我制定了以下执行计划:\n${planText}\n\n现在开始执行计划。`,
      });

      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[Plan] Step ${i + 1}/${context.maxSteps}`);

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
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'thought',
            content: stepText || `需要调用工具`,
          });

          for (const toolCall of result.toolCalls) {
            const resolvedName = nameMap[toolCall.toolName] || toolCall.toolName;

            const toolResult = await this.toolExecutor.executeToolCall(
              {
                id: toolCall.toolCallId || `tc_${Date.now()}`,
                function: {
                  name: resolvedName,
                  arguments: JSON.stringify(toolCall.args),
                },
              },
              { agent: context.agent, conversationId: context.conversationId, uid: context.uid, isolationContext: context.isolationContext },
            );

            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${resolvedName}`,
              action: resolvedName,
              actionInput: toolCall.args,
            });

            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
            });

            messages.push({
              role: 'assistant',
              content: stepText,
            });
            messages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
                  toolName: toolCall.toolName,
                  result: resultText,
                },
              ],
            } as any);
          }
        } else {
          finalResponse = stepText.trim();
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          });
          break;
        }
      }

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(context, { response: finalResponse, steps });

      return {
        response: finalResponse,
        steps,
      };
    } catch (error) {
      const errorMsg = parseAiError(error);
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

      return {
        response: errorMsg,
        steps,
      };
    }
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[Plan] 开始执行流式模式`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    const { tools, nameMap } = ToolNameSanitizer.adapt(context.tools, context.model?.provider);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      const planStep: ReasoningStep = {
        stepNumber: 1,
        stepType: 'thought',
        content: '开始制定计划...',
      };
      steps.push(planStep);
      emitter.emit(StreamEvents.reasoningStep(planStep));

      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[Plan Stream] Step ${i + 1}/${context.maxSteps}`);

        let stepText = '';
        let hasToolCall = false;

        await this.aiService.streamText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp: context.clientIp,
          userAgent: 'agent-service',
          uid: context.uid,
          onChunk: (chunk) => {
            stepText += chunk;
            emitter.emitTextDelta(chunk);
          },
          onToolCall: async (toolCall: { name: string; args: any }) => {
            const resolvedName = nameMap[toolCall.name] || toolCall.name;
            hasToolCall = true;

            const thoughtStep: ReasoningStep = {
              stepNumber: steps.length + 1,
              stepType: 'thought',
              content: stepText || `需要调用工具 ${resolvedName}`,
            };
            steps.push(thoughtStep);
            emitter.emit(StreamEvents.reasoningStep(thoughtStep));

            const actionStep: ReasoningStep = {
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${resolvedName}`,
              action: resolvedName,
              actionInput: toolCall.args,
            };
            steps.push(actionStep);
            emitter.emit(StreamEvents.reasoningStep(actionStep));

            let toolResult: any;
            if (WORKSPACE_TOOL_NAMES.has(resolvedName)) {
              const workspaceResult = await this.workspaceToolHandler.dispatchToClient(
                emitter,
                resolvedName,
                toolCall.args,
              );
              if (workspaceResult.success) {
                toolResult = workspaceResult.result;
              } else {
                throw new Error(workspaceResult.error || '客户端执行失败');
              }
            } else {
              toolResult = await this.toolExecutor.executeToolCall(
                {
                  id: `tc_${Date.now()}`,
                  function: {
                    name: resolvedName,
                    arguments: JSON.stringify(toolCall.args),
                  },
                },
                { agent: context.agent, conversationId: context.conversationId, uid: context.uid, isolationContext: context.isolationContext },
              );
            }

            emitter.emit(StreamEvents.toolCall(resolvedName, toolCall.args, toolResult.result));

            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            const observationStep: ReasoningStep = {
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
            };
            steps.push(observationStep);
            emitter.emit(StreamEvents.reasoningStep(observationStep));

            messages.push({
              role: 'assistant',
              content: stepText,
            });
            messages.push({
              role: 'user',
              content: `工具 ${toolCall.name} 返回结果:\n${resultText}\n\n请基于以上结果继续执行计划。`,
            });
          },
        });

        if (!hasToolCall) {
          finalResponse = stepText.trim();
          const finalStep: ReasoningStep = {
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          };
          steps.push(finalStep);
          emitter.emit(StreamEvents.reasoningStep(finalStep));
          break;
        }
      }

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(context, { response: finalResponse, steps });

      emitter.emitDone({
        conversationId: context.conversationId,
        response: finalResponse,
        totalCostMs: context.totalCostMs,
      });

      this.logger.log(`[Plan] 执行完成, 耗时: ${context.totalCostMs}ms`);
    } catch (error) {
      const errorMsg = parseAiError(error);
      const errorCode = getErrorCode(error);
      this.logger.error(`[Plan] 执行失败: ${errorMsg}`);
      emitter.emitError(errorMsg, errorCode);
    }
  }

  private async saveLog(context: ExecutionContext, result: { response: string; steps: ReasoningStep[] }): Promise<void> {
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
}
import { Injectable } from '@nestjs/common';
import { ReasoningMode } from '../react/react.types';
import { ReasoningResult, ReasoningStep } from './reasoning-engine.interface';
import { ExecutionContext } from '../execution/execution-context';
import { StreamEmitter } from '../../stream';
import { AiService } from '../../ai/ai.service';
import { ConversationService } from '../../conversation/conversation.service';
import { ToolExecutor } from '../tools/tool-executor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkspaceToolHandler } from '../../workspace/workspace-tool.handler';
import { BaseReasoningEngine } from './reasoning-engine.base';
import type { ModelMessage } from 'ai';

/**
 * ReAct推理引擎
 * 
 * 实现思考-行动-观察循环：
 * 1. Thought: 分析当前情况，决定下一步行动
 * 2. Action: 调用工具执行操作
 * 3. Observation: 观察工具返回结果
 * 4. 循环直到得出最终答案
 */
@Injectable()
export class ReactReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.REACT;

  constructor(
    aiService: AiService,
    conversationService: ConversationService,
    toolExecutor: ToolExecutor,
    prisma: PrismaService,
    workspaceToolHandler: WorkspaceToolHandler,
  ) {
    super(aiService, conversationService, toolExecutor, prisma, workspaceToolHandler);
  }

  /**
   * 同步执行ReAct循环
   */
  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[ReAct] 开始执行同步模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct] Step ${i + 1}/${context.maxSteps}`);

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
          const thoughtStep = this.createStep(steps.length + 1, 'thought', stepText || '需要调用工具');
          steps.push(thoughtStep);

          for (const toolCall of result.toolCalls) {
            const resolvedName = nameMap[toolCall.toolName] || toolCall.toolName;

            const toolResult = await this.executeTool(
              { id: toolCall.toolCallId, name: resolvedName, args: toolCall.args },
              context,
            );

            const actionStep = this.createStep(
              steps.length + 1,
              'action',
              `调用工具: ${resolvedName}`,
              { action: resolvedName, actionInput: toolCall.args },
            );
            steps.push(actionStep);

            const resultText = this.formatToolResult(toolResult.result);

            const observationStep = this.createStep(steps.length + 1, 'observation', resultText, { observation: resultText });
            steps.push(observationStep);

            this.pushToolMessages(messages, stepText, toolCall, resultText);
          }
        } else {
          finalResponse = stepText.trim();
          const finalStep = this.createStep(steps.length + 1, 'final_answer', finalResponse);
          steps.push(finalStep);
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

  /**
   * 流式执行ReAct循环
   */
  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[ReAct] 开始执行流式模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct Stream] Step ${i + 1}/${context.maxSteps}`);

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
          appCode: context.appCode,
          onChunk: (chunk) => {
            stepText += chunk;
            emitter.emitTextDelta(chunk);
          },
          onToolCall: async (toolCall: { name: string; args: any }) => {
            hasToolCall = true;
            const resolvedName = nameMap[toolCall.name] || toolCall.name;

            await this.handleStreamToolCall(
              context,
              messages,
              steps,
              emitter,
              stepText,
              resolvedName,
              toolCall.args,
            );
          },
        });

        if (!hasToolCall) {
          finalResponse = stepText.trim();
          const finalStep = this.createStep(steps.length + 1, 'final_answer', finalResponse);
          steps.push(finalStep);
          this.emitReasoningStep(emitter, finalStep);
          break;
        }
      }

      await this.finalizeStreamResponse(context, emitter, finalResponse, steps);
    } catch (error) {
      this.emitStreamError(error, emitter);
    }
  }

  /**
   * 处理流式模式下的工具调用
   */
  private async handleStreamToolCall(
    context: ExecutionContext,
    messages: ModelMessage[],
    steps: ReasoningStep[],
    emitter: StreamEmitter,
    stepText: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    const thoughtStep = this.createStep(steps.length + 1, 'thought', stepText || `需要调用工具 ${toolName}`);
    steps.push(thoughtStep);
    this.emitReasoningStep(emitter, thoughtStep);

    const actionStep = this.createStep(
      steps.length + 1,
      'action',
      `调用工具: ${toolName}`,
      { action: toolName, actionInput: args },
    );
    steps.push(actionStep);
    this.emitReasoningStep(emitter, actionStep);

    const toolResult = await this.executeTool({ name: toolName, args }, context, emitter);

    this.emitToolCall(emitter, toolName, args, toolResult.result);

    const resultText = this.formatToolResult(toolResult.result);

    const observationStep = this.createStep(steps.length + 1, 'observation', resultText, { observation: resultText });
    steps.push(observationStep);
    this.emitReasoningStep(emitter, observationStep);

    messages.push({ role: 'assistant', content: stepText });
    messages.push({
      role: 'user',
      content: `工具 ${toolName} 执行成功，返回结果：
${resultText}

请仔细分析以上结果：
1. 如果结果已经能够回答用户的问题，请直接给出最终答案
2. 如果结果不完整或需要补充信息，请说明原因并继续下一步操作
3. 不要重复调用已经执行过的工具，除非有明确的理由`,
    });
  }

  /**
   * 向消息列表添加工具调用消息
   */
  private pushToolMessages(
    messages: ModelMessage[],
    stepText: string,
    toolCall: { toolCallId?: string; toolName: string; args: Record<string, unknown> },
    resultText: string,
  ): void {
    messages.push({
      role: 'assistant',
      content: [
        { type: 'text', text: stepText || '' },
        {
          type: 'tool-call',
          toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
          toolName: toolCall.toolName,
          args: toolCall.args,
        },
      ],
    } as any);
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
}

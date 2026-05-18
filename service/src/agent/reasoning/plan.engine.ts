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
 * Plan推理引擎
 * 
 * 执行流程：
 * 1. 分析用户问题，制定详细执行计划
 * 2. 按计划逐步执行
 * 3. 调用工具完成各步骤
 * 4. 汇总结果返回最终答案
 */
@Injectable()
export class PlanReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.PLAN;

  /** 计划生成系统提示词 */
  private readonly PLAN_SYSTEM_PROMPT = '你是一个智能规划助手，擅长为复杂问题制定详细的执行计划。';

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
   * 同步执行Plan模式
   */
  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[Plan] 开始执行同步模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      steps.push(this.createStep(1, 'thought', '开始制定计划...'));

      const planText = await this.generatePlan(context);
      steps.push(this.createStep(2, 'thought', `计划:\n${planText}`));

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
          steps.push(this.createStep(steps.length + 1, 'thought', stepText || '需要调用工具'));

          for (const toolCall of result.toolCalls) {
            const resolvedName = nameMap[toolCall.toolName] || toolCall.toolName;

            const toolResult = await this.executeTool(
              { id: toolCall.toolCallId, name: resolvedName, args: toolCall.args },
              context,
            );

            steps.push(this.createStep(
              steps.length + 1,
              'action',
              `调用工具: ${resolvedName}`,
              { action: resolvedName, actionInput: toolCall.args },
            ));

            const resultText = this.formatToolResult(toolResult.result);

            steps.push(this.createStep(steps.length + 1, 'observation', resultText, { observation: resultText }));

            messages.push({ role: 'assistant', content: stepText });
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

  /**
   * 流式执行Plan模式
   */
  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[Plan] 开始执行流式模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      const planStep = this.createStep(1, 'thought', '开始制定计划...');
      steps.push(planStep);
      this.emitReasoningStep(emitter, planStep);

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
   * 生成执行计划
   */
  private async generatePlan(context: ExecutionContext): Promise<string> {
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
      system: this.PLAN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: planPrompt }],
      temperature: 0.3,
      clientIp: context.clientIp,
      userAgent: 'agent-service',
      uid: context.uid,
      appCode: context.appCode,
    });

    return planResult.text;
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
      content: `工具 ${toolName} 返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。`,
    });
  }
}

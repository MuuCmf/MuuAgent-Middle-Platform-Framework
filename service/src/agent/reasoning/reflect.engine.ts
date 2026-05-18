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
 * Reflect推理引擎
 * 
 * 执行流程：
 * 1. 执行ReAct循环
 * 2. 每隔一定步骤进行反思
 * 3. 分析推理过程，发现潜在问题
 * 4. 根据反思结果调整后续推理
 */
@Injectable()
export class ReflectReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.REFLECT;

  /** 反思系统提示词 */
  private readonly REFLECT_SYSTEM_PROMPT = '你是一个反思助手。请分析最近的推理步骤，指出可能的错误或改进方向。';

  /** 反思间隔（每N步进行一次反思） */
  private readonly REFLECTION_INTERVAL = 2;

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
   * 同步执行Reflect模式
   */
  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[Reflect] 开始执行同步模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[Reflect] Step ${i + 1}/${context.maxSteps}`);

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

            if (this.shouldReflect(i)) {
              const reflection = await this.generateReflection(messages, steps, context);
              steps.push(this.createStep(steps.length + 1, 'thought', `反思: ${reflection}`));
              messages.push({ role: 'assistant', content: `反思: ${reflection}` });
            }
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
   * 流式执行Reflect模式
   */
  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[Reflect] 开始执行流式模式`);

    const messages = this.buildMessages(context);
    const { tools, nameMap } = this.adaptTools(context);
    const steps: ReasoningStep[] = [];
    let finalResponse = '';

    await this.saveUserMessage(context);

    try {
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[Reflect Stream] Step ${i + 1}/${context.maxSteps}`);

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
              i,
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
   * 判断是否需要进行反思
   */
  private shouldReflect(stepIndex: number): boolean {
    return stepIndex > 0 && stepIndex % this.REFLECTION_INTERVAL === 0;
  }

  /**
   * 生成反思内容
   */
  private async generateReflection(
    messages: ModelMessage[],
    steps: ReasoningStep[],
    context: ExecutionContext,
  ): Promise<string> {
    const recentSteps = steps.slice(-4);
    const stepSummary = recentSteps.map(s => `${s.stepType}: ${s.content}`).join('\n');

    const reflectionResult = await this.aiService.generateText({
      model: context.model,
      system: this.REFLECT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `请反思以下推理过程:\n${stepSummary}\n\n请指出可能的错误、遗漏或可以改进的地方。`,
      }],
      temperature: 0.3,
      clientIp: context.clientIp,
    });

    return reflectionResult.text;
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
    stepIndex: number,
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

    if (this.shouldReflect(stepIndex)) {
      const reflection = await this.generateReflection(messages, steps, context);
      const reflectionStep = this.createStep(steps.length + 1, 'thought', `反思: ${reflection}`);
      steps.push(reflectionStep);
      this.emitReasoningStep(emitter, reflectionStep);
      messages.push({ role: 'assistant', content: `反思: ${reflection}` });
    }
  }
}

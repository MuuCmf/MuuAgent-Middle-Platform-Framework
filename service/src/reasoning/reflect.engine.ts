import { Injectable, Inject, Optional, forwardRef } from '@nestjs/common';
import { ReasoningMode, ReasoningResult, ReasoningStep } from './types';
import { ExecutionContext } from '../agent/execution/execution-context';
import { StreamEmitter } from '../stream';
import { AiService } from '../ai/ai.service';
import { TtsService } from '../ai/tts/tts.service';
import { ConversationService } from '../conversation/conversation.service';
import { ToolExecutor } from '../agent/tools/tool-executor';
import { PrismaService } from '../common/prisma/prisma.service';
import { ClientToolRegistry } from '../client-tool';
import { BaseReasoningEngine } from './base.engine';
import type { ModelMessage } from 'ai';

@Injectable()
export class ReflectReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.REFLECT;

  private readonly REFLECT_SYSTEM_PROMPT = '你是一个反思助手。请分析最近的推理步骤，指出可能的错误或改进方向。';
  private readonly REFLECTION_INTERVAL = 2;

  constructor(
    aiService: AiService,
    conversationService: ConversationService,
    toolExecutor: ToolExecutor,
    prisma: PrismaService,
    clientToolRegistry: ClientToolRegistry,
    @Optional()
    @Inject(forwardRef(() => TtsService))
    ttsService?: TtsService,
  ) {
    super(aiService, conversationService, toolExecutor, prisma, clientToolRegistry, ttsService);
  }

  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[Reflect] 开始执行同步模式`);
    return this.executeSyncLoop(context);
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[Reflect] 开始执行流式模式`);
    return this.executeStreamLoop(context, emitter);
  }

  protected async afterSyncToolExecution(
    context: ExecutionContext, messages: ModelMessage[], steps: ReasoningStep[], stepIndex: number,
  ): Promise<void> {
    if (this.shouldReflect(stepIndex)) {
      const reflection = await this.generateReflection(messages, steps, context);
      steps.push(this.createStep(steps.length + 1, 'thought', `反思: ${reflection}`));
      messages.push({ role: 'assistant', content: `反思: ${reflection}` });
    }
  }

  protected async afterStreamToolExecution(
    context: ExecutionContext, messages: ModelMessage[], steps: ReasoningStep[], emitter: StreamEmitter, stepIndex: number,
  ): Promise<void> {
    if (this.shouldReflect(stepIndex)) {
      const reflection = await this.generateReflection(messages, steps, context);
      const reflectionStep = this.createStep(steps.length + 1, 'thought', `反思: ${reflection}`);
      steps.push(reflectionStep);
      this.emitReasoningStep(emitter, reflectionStep);
      messages.push({ role: 'assistant', content: `反思: ${reflection}` });
    }
  }

  private shouldReflect(stepIndex: number): boolean {
    return stepIndex > 0 && stepIndex % this.REFLECTION_INTERVAL === 0;
  }

  private async generateReflection(
    messages: ModelMessage[], steps: ReasoningStep[], context: ExecutionContext,
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
}

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
export class PlanReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.PLAN;

  private readonly PLAN_SYSTEM_PROMPT = '你是一个智能规划助手，擅长为复杂问题制定详细的执行计划。';

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
    this.logger.log(`[Plan] 开始执行同步模式`);
    return this.executeSyncLoop(context);
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[Plan] 开始执行流式模式`);
    return this.executeStreamLoop(context, emitter);
  }

  protected async beforeSyncLoop(
    context: ExecutionContext, messages: ModelMessage[], steps: ReasoningStep[],
  ): Promise<void> {
    steps.push(this.createStep(1, 'thought', '开始制定计划...'));

    const planText = await this.generatePlan(context);
    steps.push(this.createStep(2, 'thought', `计划:\n${planText}`));

    messages.push({
      role: 'assistant',
      content: `根据分析，我制定了以下执行计划:\n${planText}\n\n现在开始执行计划。`,
    });
  }

  protected async beforeStreamLoop(
    context: ExecutionContext, _messages: ModelMessage[], steps: ReasoningStep[], emitter: StreamEmitter,
  ): Promise<void> {
    const planStep = this.createStep(1, 'thought', '开始制定计划...');
    steps.push(planStep);
    this.emitReasoningStep(emitter, planStep);
  }

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
}

import { Injectable, Logger } from '@nestjs/common';
import { ReasoningOrchestrator } from './orchestrator.interface';
import {
  ExecutionContext,
  ExecutionResult,
  ReasoningStep,
  StepType,
  ToolDefinition,
  CallLLMFn,
} from '../react/react.types';

/**
 * Plan 编排器 - 先规划再执行
 */
@Injectable()
export class PlanOrchestrator implements ReasoningOrchestrator {
  private readonly logger = new Logger(PlanOrchestrator.name);

  getName(): string {
    return 'PlanOrchestrator';
  }

  async execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // 阶段1: 生成执行计划
    const planPrompt = this.buildPlanPrompt(context);
    const planResult = await callLLM(context.systemPrompt, planPrompt);
    if (planResult.inputTokens) totalInputTokens += planResult.inputTokens;
    if (planResult.outputTokens) totalOutputTokens += planResult.outputTokens;

    const steps: ReasoningStep[] = [];

    steps.push({
      stepNumber: 1,
      stepType: StepType.THOUGHT,
      content: '生成执行计划',
      thought: planResult.response,
    });

    // 阶段2: 按计划执行 - 使用ReAct模式
    const executionPrompt = this.buildExecutionPrompt(context, planResult.response);
    const execResult = await callLLM(context.systemPrompt, executionPrompt);
    if (execResult.inputTokens) totalInputTokens += execResult.inputTokens;
    if (execResult.outputTokens) totalOutputTokens += execResult.outputTokens;

    steps.push({
      stepNumber: 2,
      stepType: StepType.FINAL_ANSWER,
      content: execResult.response,
    });

    return {
      success: true,
      response: execResult.response,
      steps,
      totalCostMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  private buildPlanPrompt(context: ExecutionContext): string {
    const toolList = context.tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    return `用户问题: ${context.userMessage}

可用工具:
${toolList || '无'}

请制定一个详细的执行计划来回答用户的问题。计划应该包含：
1. 分析用户问题的核心需求
2. 列出需要调用的工具及其参数
3. 说明每个步骤的目的和预期结果

注意：只输出计划，不要执行任何操作。`;
  }

  private buildExecutionPrompt(context: ExecutionContext, plan: string): string {
    return `用户问题: ${context.userMessage}

执行计划:
${plan}

请按照上述计划，使用 Thought/Action/Action Input/Observation 格式逐步执行。当你有足够信息回答用户问题时，使用 Final Answer 输出最终答案。`;
  }
}

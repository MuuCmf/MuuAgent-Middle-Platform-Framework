import { Injectable, Logger } from '@nestjs/common';
import { ReasoningOrchestrator } from './orchestrator.interface';
import {
  ExecutionContext,
  ExecutionResult,
  ReasoningStep,
  StepType,
  CallLLMFn,
} from '../react/react.types';
import { ReActEngine } from '../react/react.engine';

/**
 * Reflect 编排器 - 执行后反思优化
 */
@Injectable()
export class ReflectOrchestrator implements ReasoningOrchestrator {
  private readonly logger = new Logger(ReflectOrchestrator.name);

  constructor(private readonly reactEngine: ReActEngine) {}

  getName(): string {
    return 'ReflectOrchestrator';
  }

  async execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // 阶段1: 使用ReAct引擎执行
    const reactResult = await this.reactEngine.execute(context, callLLM);
    totalInputTokens += reactResult.inputTokens || 0;
    totalOutputTokens += reactResult.outputTokens || 0;

    if (!reactResult.success) {
      return reactResult;
    }

    // 阶段2: 反思
    const reflectPrompt = this.buildReflectPrompt(context, reactResult.response);
    const reflectResult = await callLLM(context.systemPrompt, reflectPrompt);
    if (reflectResult.inputTokens) totalInputTokens += reflectResult.inputTokens;
    if (reflectResult.outputTokens) totalOutputTokens += reflectResult.outputTokens;

    // 解析反思结果
    const reflectContent = reflectResult.response.trim();
    let finalResponse = reactResult.response;

    // 如果反思认为需要改进，则使用改进后的答案
    const improvedMatch = reflectContent.match(/改进后的答案[：:]\s*([\s\S]+)/i);
    if (improvedMatch && improvedMatch[1]) {
      finalResponse = improvedMatch[1].trim();
    }

    // 添加反思步骤
    const steps = [...reactResult.steps];
    steps.push({
      stepNumber: steps.length + 1,
      stepType: StepType.THOUGHT,
      content: '反思与优化',
      thought: reflectContent,
    });

    return {
      success: true,
      response: finalResponse,
      steps,
      totalCostMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  private buildReflectPrompt(context: ExecutionContext, answer: string): string {
    return `用户问题: ${context.userMessage}

初始回答:
${answer}

请反思以上回答，考虑：
1. 回答是否准确、完整？
2. 是否遗漏了重要信息？
3. 是否有可以改进的地方？

如果回答已经足够好，请直接输出：回答质量良好，无需改进。
如果需要改进，请输出改进后的答案，格式如下：
改进后的答案：[你的改进答案]`;
  }
}

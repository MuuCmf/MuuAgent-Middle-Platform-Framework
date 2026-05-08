import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionContext,
  ExecutionResult,
  ReasoningStep,
  StepType,
  CallLLMFn,
} from '../react/react.types';
import { ReasoningOrchestrator } from './orchestrator.interface';

/**
 * 默认编排器 - 保持原有执行逻辑
 */
@Injectable()
export class DefaultOrchestrator implements ReasoningOrchestrator {
  private readonly logger = new Logger(DefaultOrchestrator.name);

  getName(): string {
    return 'DefaultOrchestrator';
  }

  async execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let currentMessage = context.userMessage;
    let finalResponse = '';
    let success = true;
    let errorMessage: string | undefined;
    const steps: ReasoningStep[] = [];

    try {
      for (let step = 0; step < context.maxSteps; step++) {
        const llmResult = await callLLM(context.systemPrompt, currentMessage);
        if (llmResult.inputTokens) totalInputTokens += llmResult.inputTokens;
        if (llmResult.outputTokens) totalOutputTokens += llmResult.outputTokens;

        // 解析是否需要调用工具（原有JSON解析逻辑）
        const toolCall = this.parseToolCall(llmResult.response);

        if (!toolCall) {
          finalResponse = llmResult.response;

          steps.push({
            stepNumber: step + 1,
            stepType: StepType.FINAL_ANSWER,
            content: finalResponse,
          });
          break;
        }

        // 执行工具调用
        const stepRecord: ReasoningStep = {
          stepNumber: step + 1,
          stepType: StepType.ACTION,
          content: `调用工具: ${toolCall.skill}`,
          action: toolCall.skill as string,
          actionInput: (toolCall.params as Record<string, unknown>) || {},
        };

        try {
          const toolResult = await this.executeDefaultTool(toolCall, context);
          stepRecord.observation = typeof toolResult === 'object'
            ? JSON.stringify(toolResult, null, 2)
            : String(toolResult);
          stepRecord.toolOutput = toolResult;
          stepRecord.costMs = 0;

          steps.push(stepRecord);

          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${context.userMessage}\n\n【工具调用结果】\n工具名称: ${toolCall.skill}\n执行结果:\n${resultText}\n\n请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
        } catch (error) {
          stepRecord.observation = `错误: ${error instanceof Error ? error.message : '执行失败'}`;
          steps.push(stepRecord);
          currentMessage = `工具执行失败: ${stepRecord.observation}\n请尝试其他方式回答用户的问题。`;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法完成您的请求。';
        success = false;
        errorMessage = '达到最大执行步数';
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      finalResponse = `执行出错: ${errorMessage}`;
    }

    return {
      success,
      response: finalResponse,
      steps,
      totalCostMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      errorMessage,
    };
  }

  /**
   * 解析工具调用（原有JSON格式）
   */
  private parseToolCall(text: string): Record<string, unknown> | null {
    try {
      const trimmedText = text.trim();
      if (!trimmedText.startsWith('{') || !trimmedText.endsWith('}')) {
        return null;
      }
      const parsed = JSON.parse(trimmedText);
      if (parsed.skill && typeof parsed.skill === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 执行工具
   */
  private async executeDefaultTool(toolCall: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const skill = toolCall.skill as string;
    const params = (toolCall.params as Record<string, unknown>) || {};
    const isMcpTool = skill.startsWith('mcp:');

    // 知识库检索工具
    if (skill === 'kb_search') {
      // 默认模式下不会出现kb_search，但保留兼容
      return { message: '请在ReAct模式下使用知识库检索工具' };
    }

    // 这里需要直接调用服务，通过context传递
    // 由于DefaultOrchestrator不直接依赖服务，返回提示
    throw new Error(`默认编排器不支持直接执行工具: ${skill}。请通过AgentService调用。`);
  }
}

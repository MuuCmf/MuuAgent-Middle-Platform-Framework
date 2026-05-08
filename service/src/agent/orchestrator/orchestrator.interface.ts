import { ExecutionContext, ExecutionResult, CallLLMFn } from '../react/react.types';

/**
 * 推理编排器接口
 */
export interface ReasoningOrchestrator {
  /**
   * 执行推理
   */
  execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult>;

  /**
   * 获取编排器名称
   */
  getName(): string;
}

/**
 * 推理模式枚举
 */
export enum ReasoningMode {
  NONE = 'NONE',
  REACT = 'REACT',
  PLAN = 'PLAN',
  REFLECT = 'REFLECT',
}

/**
 * ReAct 步骤类型
 */
export enum StepType {
  THOUGHT = 'thought',
  ACTION = 'action',
  OBSERVATION = 'observation',
  FINAL_ANSWER = 'final_answer',
}

/**
 * 推理步骤接口
 */
export interface ReasoningStep {
  stepNumber: number;
  stepType: StepType;
  content?: string;
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  toolOutput?: unknown;
  costMs?: number;
}

export { ToolDefinition } from '../tools/abstract/tool.interface';

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  response: string;
  steps: ReasoningStep[];
  totalCostMs: number;
  errorMessage?: string;
  conversationId?: string;
}

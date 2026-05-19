import { StreamEmitter } from '../stream';
import { ExecutionContext } from '../agent/execution/execution-context';

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
 * 推理步骤
 */
export interface ReasoningStep {
  stepNumber: number;
  stepType: 'thought' | 'action' | 'observation' | 'final_answer';
  content: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
}

/**
 * 推理结果
 */
export interface ReasoningResult {
  response: string;
  steps: ReasoningStep[];
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}

/**
 * 推理引擎接口
 */
export interface IReasoningEngine {
  readonly mode: ReasoningMode;

  executeSync(context: ExecutionContext): Promise<ReasoningResult>;

  executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void>;
}

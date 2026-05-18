import { ReasoningMode } from '../react/react.types';
import { StreamEmitter } from '../../stream';
import { ExecutionContext } from '../execution/execution-context';

export interface ReasoningStep {
  stepNumber: number;
  stepType: 'thought' | 'action' | 'observation' | 'final_answer';
  content: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
}

export interface ReasoningResult {
  response: string;
  steps: ReasoningStep[];
  toolCalls?: { name: string; args: Record<string, unknown> }[];
}

export interface IReasoningEngine {
  readonly mode: ReasoningMode;

  executeSync(
    context: ExecutionContext,
  ): Promise<ReasoningResult>;

  executeStream(
    context: ExecutionContext,
    emitter: StreamEmitter,
  ): Promise<void>;
}
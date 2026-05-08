import { Injectable } from '@nestjs/common';
import { ReasoningOrchestrator } from './orchestrator.interface';
import { ExecutionContext, ExecutionResult, CallLLMFn } from '../react/react.types';
import { ReActEngine } from '../react/react.engine';

/**
 * ReAct 编排器
 */
@Injectable()
export class ReActOrchestrator implements ReasoningOrchestrator {
  constructor(private readonly reactEngine: ReActEngine) {}

  getName(): string {
    return 'ReActOrchestrator';
  }

  async execute(
    context: ExecutionContext,
    callLLM: CallLLMFn,
  ): Promise<ExecutionResult> {
    return this.reactEngine.execute(context, callLLM);
  }
}

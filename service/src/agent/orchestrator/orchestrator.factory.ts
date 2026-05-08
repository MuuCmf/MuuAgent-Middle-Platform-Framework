import { Injectable } from '@nestjs/common';
import { ReasoningMode } from '../react/react.types';
import { ReasoningOrchestrator } from './orchestrator.interface';
import { DefaultOrchestrator } from './default.orchestrator';
import { ReActOrchestrator } from './react.orchestrator';
import { PlanOrchestrator } from './plan.orchestrator';
import { ReflectOrchestrator } from './reflect.orchestrator';

/**
 * 编排器工厂
 */
@Injectable()
export class OrchestratorFactory {
  private orchestrators: Map<ReasoningMode, ReasoningOrchestrator>;

  constructor(
    private defaultOrchestrator: DefaultOrchestrator,
    private reactOrchestrator: ReActOrchestrator,
    private planOrchestrator: PlanOrchestrator,
    private reflectOrchestrator: ReflectOrchestrator,
  ) {
    this.orchestrators = new Map<ReasoningMode, ReasoningOrchestrator>([
      [ReasoningMode.NONE, defaultOrchestrator],
      [ReasoningMode.REACT, reactOrchestrator],
      [ReasoningMode.PLAN, planOrchestrator],
      [ReasoningMode.REFLECT, reflectOrchestrator],
    ]);
  }

  /**
   * 获取编排器
   */
  getOrchestrator(mode: ReasoningMode | string): ReasoningOrchestrator {
    const orchestrator = this.orchestrators.get(mode as ReasoningMode);
    if (!orchestrator) {
      throw new Error(`不支持的推理模式: ${mode}`);
    }
    return orchestrator;
  }
}

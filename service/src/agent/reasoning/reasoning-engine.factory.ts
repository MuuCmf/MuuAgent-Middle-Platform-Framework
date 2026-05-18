import { Injectable, Logger } from '@nestjs/common';
import { ReasoningMode } from '../react/react.types';
import { IReasoningEngine } from './reasoning-engine.interface';
import { NoneReasoningEngine } from './none.engine';
import { ReactReasoningEngine } from './react.engine';
import { PlanReasoningEngine } from './plan.engine';
import { ReflectReasoningEngine } from './reflect.engine';

@Injectable()
export class ReasoningEngineFactory {
  private readonly logger = new Logger(ReasoningEngineFactory.name);
  private engines = new Map<ReasoningMode, IReasoningEngine>();

  constructor(
    private readonly noneEngine: NoneReasoningEngine,
    private readonly reactEngine: ReactReasoningEngine,
    private readonly planEngine: PlanReasoningEngine,
    private readonly reflectEngine: ReflectReasoningEngine,
  ) {
    this.registerEngine(noneEngine);
    this.registerEngine(reactEngine);
    this.registerEngine(planEngine);
    this.registerEngine(reflectEngine);
    this.logger.log(`推理引擎工厂已初始化，共 ${this.engines.size} 个引擎`);
  }

  registerEngine(engine: IReasoningEngine): void {
    this.engines.set(engine.mode, engine);
    this.logger.debug(`推理引擎已注册: ${engine.mode}`);
  }

  getEngine(mode: ReasoningMode): IReasoningEngine {
    const engine = this.engines.get(mode);
    if (engine) {
      return engine;
    }
    this.logger.warn(`未找到推理引擎: ${mode}，使用默认引擎`);
    return this.noneEngine;
  }

  getAvailableModes(): ReasoningMode[] {
    return Array.from(this.engines.keys());
  }
}
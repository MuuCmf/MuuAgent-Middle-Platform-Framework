import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConversationModule } from '../conversation/conversation.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CommonModule } from '../common/common.module';
import { AgentModule } from '../agent/agent.module';

import { NoneReasoningEngine } from './none.engine';
import { ReactReasoningEngine } from './react.engine';
import { PlanReasoningEngine } from './plan.engine';
import { ReflectReasoningEngine } from './reflect.engine';
import { ReasoningEngineFactory } from './reasoning.factory';

@Module({
  imports: [
    AiModule,
    ConversationModule,
    WorkspaceModule,
    CommonModule,
    forwardRef(() => AgentModule),
  ],
  providers: [
    NoneReasoningEngine,
    ReactReasoningEngine,
    PlanReasoningEngine,
    ReflectReasoningEngine,
    ReasoningEngineFactory,
  ],
  exports: [
    ReasoningEngineFactory,
  ],
})
export class ReasoningModule {}

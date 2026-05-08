import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentKbService } from './agent-kb.service';
import { AgentController, AgentAdminController } from './agent.controller';
import { McpModule } from '../mcp/mcp.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillModule } from '../skill/skill.module';
import { ModelModule } from '../model/model.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiModule } from '../ai/ai.module';
import { ReActEngine } from './react/react.engine';
import { OrchestratorFactory } from './orchestrator/orchestrator.factory';
import { DefaultOrchestrator } from './orchestrator/default.orchestrator';
import { ReActOrchestrator } from './orchestrator/react.orchestrator';
import { PlanOrchestrator } from './orchestrator/plan.orchestrator';
import { ReflectOrchestrator } from './orchestrator/reflect.orchestrator';
import { KbSearchTool } from './tools/kb-search.tool';

/**
 * 智能体模块
 */
@Module({
  imports: [McpModule, McpServerModule, SkillModule, ModelModule, RetrievalModule, AiModule],
  controllers: [AgentController, AgentAdminController],
  providers: [
    AgentService,
    AgentKbService,
    // ReAct 引擎和编排器
    ReActEngine,
    DefaultOrchestrator,
    ReActOrchestrator,
    PlanOrchestrator,
    ReflectOrchestrator,
    OrchestratorFactory,
    // 知识库检索工具
    KbSearchTool,
  ],
  exports: [AgentService, AgentKbService],
})
export class AgentModule {}

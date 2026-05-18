import { Module, OnModuleInit, Injectable } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController, AgentAdminController } from './agent.controller';
import { ModelRoutingModule } from "../model-routing/model-routing.module";
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillModule } from '../skill/skill.module';
import { ModelModule } from '../model/model.module';
import { ModelTemplateModule } from '../model-template/model-template.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiModule } from '../ai/ai.module';
import { KbSearchTool } from './tools/kb-search.tool';
import { ToolExecutor } from './tools/tool-executor';
import { HttpRequestTool } from './tools/http-request.tool';
import { RunCodeTool } from './tools/run-code.tool';
import { DbQueryTool } from './tools/db-query.tool';
import { RunScriptTool } from './tools/run-script.tool';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { ConversationModule } from '../conversation/conversation.module';
import { IntentModule } from '../intent/intent.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CommonModule } from '../common/common.module';

import { ToolRegistry } from './tools/tool-registry';
import { UseSkillTool } from './tools/skill-meta/use-skill.tool';
import { LoadReferenceTool } from './tools/skill-meta/load-reference.tool';
import { RunScriptTool as SkillRunScriptTool } from './tools/skill-meta/run-script-tool';

import { ContextBuilder } from './execution/context-builder';
import { ExecutionContext } from './execution/execution-context';

import { ReasoningEngineFactory } from './reasoning/reasoning-engine.factory';
import { NoneReasoningEngine } from './reasoning/none.engine';
import { ReactReasoningEngine } from './reasoning/react.engine';
import { PlanReasoningEngine } from './reasoning/plan.engine';
import { ReflectReasoningEngine } from './reasoning/reflect.engine';

@Injectable()
export class ToolRegistrar implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly useSkillTool: UseSkillTool,
    private readonly loadReferenceTool: LoadReferenceTool,
    private readonly runScriptTool: SkillRunScriptTool,
  ) {}

  onModuleInit() {
    if (this.toolRegistry) {
      this.toolRegistry.register(this.useSkillTool);
      this.toolRegistry.register(this.loadReferenceTool);
      this.toolRegistry.register(this.runScriptTool);
    }
  }
}

@Module({
  imports: [
    ModelRoutingModule,
    McpServerModule,
    SkillModule,
    ModelModule,
    ModelTemplateModule,
    RetrievalModule,
    AiModule,
    PromptTemplateModule,
    ConversationModule,
    IntentModule,
    WorkspaceModule,
    CommonModule,
  ],
  controllers: [AgentController, AgentAdminController],
  providers: [
    AgentService,
    ContextBuilder,
    ExecutionContext,
    ReasoningEngineFactory,
    NoneReasoningEngine,
    ReactReasoningEngine,
    PlanReasoningEngine,
    ReflectReasoningEngine,
    ToolRegistry,
    ToolExecutor,
    KbSearchTool,
    HttpRequestTool,
    RunCodeTool,
    DbQueryTool,
    RunScriptTool,
    UseSkillTool,
    LoadReferenceTool,
    SkillRunScriptTool,
    ToolRegistrar,
  ],
  exports: [AgentService, ToolExecutor, ToolRegistry],
})
export class AgentModule {}
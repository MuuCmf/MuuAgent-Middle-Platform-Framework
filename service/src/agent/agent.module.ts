import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
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
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { ConversationModule } from '../conversation/conversation.module';
import { IntentModule } from '../intent/intent.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CommonModule } from '../common/common.module';

import { ToolRegistry } from './tools/tool-registry';
import { UseSkillTool } from './tools/skill-meta/use-skill.tool';
import { LoadReferenceTool } from './tools/skill-meta/load-reference.tool';
import { RunScriptTool } from './tools/skill-meta/run-script-tool';

import {
  TOOL_DISPATCHERS,
  RegisteredToolDispatcher,
  McpToolDispatcher,
  KbSearchDispatcher,
  WorkspaceToolDispatcher,
  BuiltinFunctionDispatcher,
} from './tools/tool-dispatchers';

import { ContextBuilder } from './execution/context-builder';
import { SkillResolutionBuilder } from './execution/skill-resolution.builder';
import { ToolAssemblyBuilder } from './execution/tool-assembly.builder';
import { SystemPromptBuilder } from './execution/system-prompt.builder';
import { ModelParamsBuilder } from './execution/model-params.builder';
import { ExecutionContext } from './execution/execution-context';
import { HybridRetrievalService } from './hybrid-retrieval.service';

import { ReasoningModule } from '../reasoning/reasoning.module';

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
    forwardRef(() => ReasoningModule),
  ],
  controllers: [AgentController, AgentAdminController],
  providers: [
    AgentService,
    ContextBuilder,
    SkillResolutionBuilder,
    ToolAssemblyBuilder,
    SystemPromptBuilder,
    ModelParamsBuilder,
    ExecutionContext,
    HybridRetrievalService,
    ToolRegistry,
    ToolExecutor,
    KbSearchTool,
    HttpRequestTool,
    RunCodeTool,
    DbQueryTool,
    UseSkillTool,
    LoadReferenceTool,
    RunScriptTool,

    // 工具 dispatcher 链
    RegisteredToolDispatcher,
    McpToolDispatcher,
    KbSearchDispatcher,
    WorkspaceToolDispatcher,
    BuiltinFunctionDispatcher,
    {
      provide: TOOL_DISPATCHERS,
      useFactory: (
        registered: RegisteredToolDispatcher,
        mcp: McpToolDispatcher,
        kb: KbSearchDispatcher,
        workspace: WorkspaceToolDispatcher,
        builtin: BuiltinFunctionDispatcher,
      ) => [registered, mcp, kb, workspace, builtin],
      inject: [
        RegisteredToolDispatcher,
        McpToolDispatcher,
        KbSearchDispatcher,
        WorkspaceToolDispatcher,
        BuiltinFunctionDispatcher,
      ],
    },
  ],
  exports: [AgentService, ToolExecutor, ToolRegistry],
})
export class AgentModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly useSkillTool: UseSkillTool,
    private readonly loadReferenceTool: LoadReferenceTool,
    private readonly runScriptTool: RunScriptTool,
    private readonly httpRequestTool: HttpRequestTool,
    private readonly runCodeTool: RunCodeTool,
    private readonly dbQueryTool: DbQueryTool,
  ) {}

  onModuleInit() {
    this.toolRegistry.register(this.useSkillTool);
    this.toolRegistry.register(this.loadReferenceTool);
    this.toolRegistry.register(this.runScriptTool);
    this.toolRegistry.register(this.httpRequestTool);
    this.toolRegistry.register(this.runCodeTool);
    this.toolRegistry.register(this.dbQueryTool);
  }
}

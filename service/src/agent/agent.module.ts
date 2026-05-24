import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController, AgentAdminController } from './agent.controller';
import { ModelRoutingModule } from '../model-routing/model-routing.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillModule } from '../skill/skill.module';
import { ModelModule } from '../model/model.module';
import { ModelTemplateModule } from '../model-template/model-template.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AiModule } from '../ai/ai.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { ConversationModule } from '../conversation/conversation.module';
import { IntentModule } from '../intent/intent.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DesktopModule } from '../desktop/desktop.module';
import { CommonModule } from '../common/common.module';

import { ToolModule } from './tools';

import { ContextBuilder } from './execution/context-builder';
import { SkillResolutionBuilder } from './execution/skill-resolution.builder';
import { ToolAssemblyBuilder } from './execution/tool-assembly.builder';
import { SystemPromptBuilder } from './execution/system-prompt.builder';
import { ModelParamsBuilder } from './execution/model-params.builder';
import { ExecutionContext } from './execution/execution-context';
import { HybridRetrievalService } from './hybrid-retrieval.service';

import { ReasoningModule } from '../reasoning/reasoning.module';

/**
 * Agent 模块
 *
 * 工具已通过 ToolModule 的 ToolDiscoveryService 自动发现注册
 * 无需手动注册工具
 */
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
    DesktopModule,
    CommonModule,
    ToolModule,
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
  ],
  exports: [AgentService],
})
export class AgentModule {}

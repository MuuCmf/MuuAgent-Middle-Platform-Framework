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
import { AiSdkModule } from '../ai/providers/ai-sdk.module';
import { KbSearchTool } from './tools/kb-search.tool';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';

/**
 * 智能体模块
 */
@Module({
  imports: [McpModule, McpServerModule, SkillModule, ModelModule, RetrievalModule, AiModule, AiSdkModule, PromptTemplateModule],
  controllers: [AgentController, AgentAdminController],
  providers: [
    AgentService,
    AgentKbService,
    KbSearchTool,
  ],
  exports: [AgentService, AgentKbService],
})
export class AgentModule {}

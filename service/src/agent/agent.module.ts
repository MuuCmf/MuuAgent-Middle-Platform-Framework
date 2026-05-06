import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController, AgentAdminController } from './agent.controller';
import { McpModule } from '../mcp/mcp.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillModule } from '../skill/skill.module';
import { ModelModule } from '../model/model.module';

/**
 * 智能体模块
 */
@Module({
  imports: [McpModule, McpServerModule, SkillModule, ModelModule],
  controllers: [AgentController, AgentAdminController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

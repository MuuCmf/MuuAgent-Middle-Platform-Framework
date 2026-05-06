import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { SkillModule } from '../skill/skill.module';

/**
 * MCP Server模块
 * 提供MCP Server的管理功能
 */
@Module({
  imports: [SkillModule],
  controllers: [McpServerController],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpServerModule {}

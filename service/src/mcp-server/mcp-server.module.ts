import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { McpServerRegistry } from './mcp-server-registry';
import { McpServerRepository } from './mcp-server.repository';
import { SkillModule } from '../skill/skill.module';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * MCP Server模块
 * 提供MCP Server的管理功能
 */
@Module({
  imports: [SkillModule, PrismaModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRegistry, McpServerRepository],
  exports: [McpServerService, McpServerRegistry, McpServerRepository],
})
export class McpServerModule {}

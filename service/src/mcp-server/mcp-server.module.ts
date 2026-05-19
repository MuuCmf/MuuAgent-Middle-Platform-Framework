import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { McpServerRegistry } from './mcp-server-registry';
import { McpServerRepository } from './mcp-server.repository';
import { McpClientService } from './mcp-client.service';
import { McpToolExecutor } from './mcp-tool.executor';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * MCP Server模块
 * 提供MCP Server的管理功能及MCP协议客户端
 */
@Module({
  imports: [PrismaModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRegistry, McpServerRepository, McpClientService, McpToolExecutor],
  exports: [McpServerService, McpServerRegistry, McpServerRepository, McpClientService, McpToolExecutor],
})
export class McpServerModule {}

import { Module, OnModuleInit } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { McpServerRegistry } from './mcp-server-registry';
import { SkillModule } from '../skill/skill.module';

/**
 * MCP Server模块
 * 提供MCP Server的管理功能
 */
@Module({
  imports: [SkillModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRegistry],
  exports: [McpServerService, McpServerRegistry],
})
export class McpServerModule implements OnModuleInit {
  constructor(
    private readonly mcpServerRegistry: McpServerRegistry,
  ) {}

  async onModuleInit() {
    await this.loadMcpServersFromConfig();
  }

  private async loadMcpServersFromConfig() {
    try {
      const mcpConfigEnv = process.env.MCP_SERVER_CONFIG;
      if (mcpConfigEnv) {
        const servers = JSON.parse(mcpConfigEnv);
        if (Array.isArray(servers)) {
          this.mcpServerRegistry.registerAll(servers);
        }
      }
    } catch (error) {
      console.error('从环境变量加载MCP Server配置失败:', error);
    }
  }
}

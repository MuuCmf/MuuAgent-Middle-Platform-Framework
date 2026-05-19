import { Injectable } from '@nestjs/common';
import { IExecutor } from '../skill/interfaces/executor.interface';
import { McpClientService } from './mcp-client.service';
import { McpServerRegistry } from './mcp-server-registry';

/**
 * MCP 工具执行器（统一 IExecutor 接口）
 * 包装 McpClientService，提供标准化的 canExecute/execute 契约
 */
@Injectable()
export class McpToolExecutor implements IExecutor {
  readonly name = 'mcp-tool';

  constructor(
    private readonly mcpClient: McpClientService,
    private readonly registry: McpServerRegistry,
  ) {}

  canExecute(toolName: string): boolean {
    return toolName.startsWith('mcp__');
  }

  async execute(args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const fullToolName = args.tool_name as string;
    if (!fullToolName) {
      return { success: false, error: '缺少 tool_name 参数' };
    }

    const parts = fullToolName.split('__');
    if (parts.length < 3) {
      return { success: false, error: `Invalid MCP tool name: ${fullToolName}` };
    }

    const serverName = parts[1];
    const toolName = parts.slice(2).join('__');

    try {
      const serverConfig = await this.registry.getServer(serverName);
      if (!serverConfig) {
        return { success: false, error: `MCP server not found: ${serverName}` };
      }

      const result = await this.mcpClient.callTool(
        { url: serverConfig.url, apiKey: serverConfig.apiKey, timeout: serverConfig.timeout },
        toolName,
        (args.parameters as Record<string, unknown>) || {},
      );

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

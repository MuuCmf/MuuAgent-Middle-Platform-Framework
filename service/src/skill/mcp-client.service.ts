import { Injectable, Logger } from '@nestjs/common';

/**
 * MCP客户端配置接口
 */
interface McpClientConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * MCP工具定义接口
 */
interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP客户端服务
 * 通过 HTTP POST 方式调用第三方 MCP Server 的 tools/list 和 tools/call
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);

  /**
   * 获取工具列表
   * @param config MCP配置
   * @returns {Promise<McpTool[]>} 工具列表
   */
  async listTools(config: McpClientConfig): Promise<McpTool[]> {
    const axios = require('axios').default;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await axios.post(config.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }, {
        headers,
        timeout: config.timeout || 30000,
      });

      const tools = response.data?.result?.tools || [];
      return tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      this.logger.error(`获取工具列表失败: ${error}`);
      throw error;
    }
  }

  /**
   * 调用工具
   * @param config MCP配置
   * @param toolName 工具名称
   * @param args 参数
   * @returns {Promise<unknown>} 执行结果
   */
  async callTool(
    config: McpClientConfig,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const axios = require('axios').default;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await axios.post(config.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }, {
        headers,
        timeout: config.timeout || 30000,
      });

      if (response.data?.error) {
        throw new Error(response.data.error.message || '调用失败');
      }

      const result = response.data?.result;

      if (result?.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');

        if (textContent) {
          return textContent;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`调用工具失败: ${error}`);
      throw error;
    }
  }
}
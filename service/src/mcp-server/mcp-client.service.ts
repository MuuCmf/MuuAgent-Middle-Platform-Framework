import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

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
 * 使用官方 @modelcontextprotocol/sdk 实现与 MCP Server 的通信
 * 支持 Streamable HTTP 和 SSE 协议
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);

  /**
   * MCP 客户端缓存（按 URL 分组）
   */
  private clients = new Map<string, Client>();

  /**
   * 模块销毁时清理资源
   */
  async onModuleDestroy() {
    for (const [key, client] of this.clients) {
      try {
        await client.close();
        this.logger.debug(`关闭 MCP 客户端: ${key}`);
      } catch (error) {
        this.logger.warn(`关闭 MCP 客户端失败: ${(error as Error).message}`);
      }
    }
    this.clients.clear();
    this.logger.log('MCP 客户端资源已清理');
  }

  /**
   * 生成缓存 Key
   * @param config MCP 配置
   * @returns {string} 缓存 Key
   */
  private getCacheKey(config: McpClientConfig): string {
    return `${config.url}:${config.apiKey || 'none'}`;
  }

  /**
   * 检测 URL 类型（SSE 或 Streamable HTTP）
   * @param url URL 字符串
   * @returns {boolean} 是否为 SSE 端点
   */
  private isSseEndpoint(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    if (
      lowerUrl.includes('/sse') ||
      lowerUrl.endsWith('/sse/') ||
      lowerUrl.includes('sse?')
    ) {
      return true;
    }

    if (lowerUrl.includes('open.bigmodel.cn/api/mcp/')) {
      return true;
    }

    return false;
  }

  /**
   * 检查 URL 中是否包含认证参数
   * @param url URL 字符串
   * @returns {boolean} 是否包含认证参数
   */
  private hasAuthInUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const authParams = ['Authorization', 'token', 'apikey', 'api_key', 'key'];
      return authParams.some(param => parsedUrl.searchParams.has(param));
    } catch {
      return false;
    }
  }

  /**
   * 构建 SSE URL（如果需要）
   * @param config MCP 配置
   * @returns {URL} 构建后的 URL
   */
  private buildSseUrl(config: McpClientConfig): URL {
    let url = config.url;

    if (!this.isSseEndpoint(url)) {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];

      if (lastPart === 'mcp') {
        pathParts[pathParts.length - 1] = 'sse';
        urlObj.pathname = pathParts.join('/');
      } else {
        urlObj.pathname = urlObj.pathname.replace(/\/mcp$/, '/sse');
        if (urlObj.pathname === url) {
          urlObj.pathname = urlObj.pathname + '/sse';
        }
      }
      url = urlObj.toString();
    }

    const urlObj = new URL(url);

    if (config.apiKey && !this.hasAuthInUrl(config.url)) {
      urlObj.searchParams.set('Authorization', config.apiKey);
    }

    return urlObj;
  }

  /**
   * 构建 Streamable HTTP URL
   * @param config MCP 配置
   * @returns {URL} 构建后的 URL
   */
  private buildStreamableHttpUrl(config: McpClientConfig): URL {
    return new URL(config.url);
  }

  /**
   * 获取或创建 MCP 客户端
   * @param config MCP 配置
   * @returns {Promise<Client>} MCP 客户端
   */
  private async getOrCreateClient(config: McpClientConfig): Promise<Client> {
    const key = this.getCacheKey(config);

    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    const client = new Client(
      {
        name: 'muuai-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
      },
    );

    const isSse = this.isSseEndpoint(config.url);

    try {
      if (isSse) {
        const sseUrl = this.buildSseUrl(config);
        this.logger.debug(`使用 SSE 传输: ${sseUrl.toString()}`);
        this.logger.debug(`API Key: ${config.apiKey ? '已提供' : '未提供'}`);

        const transport = new SSEClientTransport(sseUrl);

        await client.connect(transport);
        this.logger.log(`MCP 客户端连接成功 (SSE): ${config.url}`);
      } else {
        const httpUrl = this.buildStreamableHttpUrl(config);
        this.logger.debug(`使用 Streamable HTTP 传输: ${httpUrl.toString()}`);

        const headers: Record<string, string> = {};
        if (config.apiKey && !this.hasAuthInUrl(config.url)) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const transport = new StreamableHTTPClientTransport(httpUrl, {
          requestInit: {
            headers,
          },
        });

        await client.connect(transport);
        this.logger.log(`MCP 客户端连接成功 (Streamable HTTP): ${config.url}`);
      }

      this.clients.set(key, client);

      return client;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`MCP 客户端连接失败: ${err.message}`);
      throw error;
    }
  }

  /**
   * 获取工具列表
   * @param config MCP配置
   * @returns {Promise<McpTool[]>} 工具列表
   */
  async listTools(config: McpClientConfig): Promise<McpTool[]> {
    try {
      const client = await this.getOrCreateClient(config);

      const result = await client.listTools();

      const tools = result.tools || [];
      this.logger.debug(`获取到 ${tools.length} 个工具`);

      return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`获取工具列表失败: ${err.message}`);
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
    try {
      const client = await this.getOrCreateClient(config);

      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      if (result.isError) {
        const content = result.content as Array<{ type: string; text?: string }>;
        const errorContent = content
          .filter(c => c.type === 'text')
          .map(c => c.text || '')
          .join('\n');
        throw new Error(errorContent || '工具调用失败');
      }

      const content = result.content as Array<{ type: string; text?: string }>;
      const textContent = content
        .filter(c => c.type === 'text')
        .map(c => c.text || '')
        .join('\n');

      if (textContent) {
        return textContent;
      }

      return result.content;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`调用工具 ${toolName} 失败: ${err.message}`);
      throw error;
    }
  }

  /**
   * 健康检查
   * @param config MCP配置
   * @returns {Promise<{ healthy: boolean; latency: number; error?: string }>} 健康状态
   */
  async healthCheck(config: McpClientConfig): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const shortTimeoutConfig = {
        ...config,
        timeout: Math.min(config.timeout || 5000, 5000),
      };

      await this.getOrCreateClient(shortTimeoutConfig);

      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error;
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * 清除客户端缓存
   * @param url 可选，指定 URL 则只清除该 URL 的缓存
   */
  async clearCache(url?: string): Promise<void> {
    if (url) {
      const keysToDelete = Array.from(this.clients.keys()).filter(k =>
        k.startsWith(url),
      );

      for (const key of keysToDelete) {
        const client = this.clients.get(key);
        if (client) {
          try {
            await client.close();
          } catch (error) {
            this.logger.warn(`关闭客户端失败: ${(error as Error).message}`);
          }
        }
        this.clients.delete(key);
      }

      this.logger.debug(`清除了 ${keysToDelete.length} 个客户端缓存`);
    } else {
      for (const client of this.clients.values()) {
        try {
          await client.close();
        } catch (error) {
          this.logger.warn(`关闭客户端失败: ${(error as Error).message}`);
        }
      }
      this.clients.clear();
      this.logger.debug('清除了所有客户端缓存');
    }
  }
}

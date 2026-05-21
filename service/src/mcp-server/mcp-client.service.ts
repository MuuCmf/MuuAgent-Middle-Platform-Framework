import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChildProcess } from 'child_process';
import { McpClientConfig, StdioProcess, McpTransport } from './types/mcp-server.types';

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
 * 支持 Streamable HTTP、SSE 和 stdio 三种协议
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);

  /**
   * MCP 客户端缓存（按配置 Key 分组）
   */
  private clients = new Map<string, Client>();

  /**
   * stdio 进程管理缓存
   */
  private stdioProcesses = new Map<string, StdioProcess>();

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

    for (const [key, { process }] of this.stdioProcesses) {
      try {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 3000);
        this.logger.debug(`终止 stdio 进程: ${key}`);
      } catch (error) {
        this.logger.warn(`终止 stdio 进程失败: ${(error as Error).message}`);
      }
    }
    this.stdioProcesses.clear();

    this.logger.log('MCP 客户端资源已清理');
  }

  /**
   * 生成缓存 Key
   * @param config MCP 配置
   * @returns {string} 缓存 Key
   */
  private getCacheKey(config: McpClientConfig): string {
    if (config.transport === 'stdio') {
      return `stdio:${config.command}:${JSON.stringify(config.args || [])}`;
    }
    return `${config.transport}:${config.url}:${config.apiKey || 'none'}`;
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
    let url = config.url!;
    const urlObj = new URL(url);

    if (!urlObj.pathname.endsWith('/sse') && !urlObj.pathname.endsWith('/sse/')) {
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/sse';
    }

    if (config.apiKey && !this.hasAuthInUrl(config.url!)) {
      urlObj.searchParams.set('Authorization', config.apiKey);
    }

    return urlObj;
  }

  /**
   * 创建 stdio 传输
   * @param config MCP 配置
   * @param key 缓存 Key
   * @returns {Promise<StdioClientTransport>} stdio 传输实例
   */
  private async createStdioTransport(
    config: McpClientConfig,
    key: string,
  ): Promise<StdioClientTransport> {
    if (!config.command) {
      throw new Error('stdio 协议需要提供 command');
    }

    this.logger.debug(
      `启动 stdio 进程: ${config.command} ${(config.args || []).join(' ')}`,
    );

    const mergedEnv: Record<string, string> = {};
    Object.entries({ ...process.env, ...config.env }).forEach(([k, v]) => {
      if (v !== undefined) {
        mergedEnv[k] = v;
      }
    });

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: mergedEnv,
    });

    this.stdioProcesses.set(key, {
      process: null as unknown as ChildProcess,
      client: null,
      lastUsed: Date.now(),
    });

    return transport;
  }

  /**
   * 创建 SSE 传输
   * @param config MCP 配置
   * @returns {SSEClientTransport} SSE 传输实例
   */
  private createSseTransport(config: McpClientConfig): SSEClientTransport {
    const sseUrl = this.buildSseUrl(config);
    this.logger.debug(`使用 SSE 传输: ${sseUrl.toString()}`);
    this.logger.debug(`API Key: ${config.apiKey ? '已提供' : '未提供'}`);
    return new SSEClientTransport(sseUrl);
  }

  /**
   * 创建 Streamable HTTP 传输
   * @param config MCP 配置
   * @returns {StreamableHTTPClientTransport} HTTP 传输实例
   */
  private createHttpTransport(config: McpClientConfig): StreamableHTTPClientTransport {
    const httpUrl = new URL(config.url!);
    this.logger.debug(`使用 Streamable HTTP 传输: ${httpUrl.toString()}`);

    const headers: Record<string, string> = {};
    if (config.apiKey && !this.hasAuthInUrl(config.url!)) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    return new StreamableHTTPClientTransport(httpUrl, {
      requestInit: {
        headers,
      },
    });
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
        name: 'muu-agent-mcp-client',
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

    try {
      let transport;
      let actualTransport = config.transport || 'http';

      if (actualTransport === 'http' && config.url && this.isSseEndpoint(config.url)) {
        actualTransport = 'sse';
        this.logger.debug(`自动检测到 SSE 端点，切换为 SSE 协议`);
      }

      switch (actualTransport) {
        case 'stdio':
          transport = await this.createStdioTransport(config, key);
          break;
        case 'sse':
          transport = this.createSseTransport(config);
          break;
        case 'http':
        default:
          if (!config.url) {
            throw new Error('HTTP/SSE 协议需要提供 URL');
          }
          transport = this.createHttpTransport(config);
          break;
      }

      await client.connect(transport);
      this.clients.set(key, client);

      const stdioProcess = this.stdioProcesses.get(key);
      if (stdioProcess) {
        stdioProcess.client = client;
      }

      this.logger.log(`MCP 客户端连接成功 (${actualTransport})`);

      return client;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`MCP 客户端连接失败: ${err.message}`);

      const stdioProcess = this.stdioProcesses.get(key);
      if (stdioProcess) {
        try {
          stdioProcess.process.kill('SIGTERM');
        } catch (e) {
          // ignore
        }
        this.stdioProcesses.delete(key);
      }

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
   * @param key 可选，指定缓存 Key 则只清除该缓存
   */
  async clearCache(key?: string): Promise<void> {
    if (key) {
      const client = this.clients.get(key);
      if (client) {
        try {
          await client.close();
        } catch (error) {
          this.logger.warn(`关闭客户端失败: ${(error as Error).message}`);
        }
        this.clients.delete(key);
      }

      const stdioProcess = this.stdioProcesses.get(key);
      if (stdioProcess) {
        try {
          stdioProcess.process.kill('SIGTERM');
        } catch (error) {
          this.logger.warn(`终止 stdio 进程失败: ${(error as Error).message}`);
        }
        this.stdioProcesses.delete(key);
      }

      this.logger.debug(`清除了缓存: ${key}`);
    } else {
      for (const client of this.clients.values()) {
        try {
          await client.close();
        } catch (error) {
          this.logger.warn(`关闭客户端失败: ${(error as Error).message}`);
        }
      }
      this.clients.clear();

      for (const { process } of this.stdioProcesses.values()) {
        try {
          process.kill('SIGTERM');
        } catch (error) {
          this.logger.warn(`终止 stdio 进程失败: ${(error as Error).message}`);
        }
      }
      this.stdioProcesses.clear();

      this.logger.debug('清除了所有客户端缓存');
    }
  }

  /**
   * 获取当前活跃的 stdio 进程数量
   * @returns {number} 进程数量
   */
  getActiveStdioProcessCount(): number {
    return this.stdioProcesses.size;
  }

  /**
   * 获取当前缓存的客户端数量
   * @returns {number} 客户端数量
   */
  getCachedClientCount(): number {
    return this.clients.size;
  }
}

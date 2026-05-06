import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

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
 * MCP JSON-RPC 请求接口
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP JSON-RPC 响应接口
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP客户端服务
 * 用于连接和调用第三方MCP Server
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private readonly connections: Map<string, { eventSource: EventEmitter; requestId: number }> = new Map();
  private readonly pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  /**
   * 模块销毁时清理连接
   */
  onModuleDestroy() {
    for (const [key] of this.connections) {
      this.disconnect(key);
    }
  }

  /**
   * 连接MCP Server
   * @param config 连接配置
   * @returns {Promise<string>} 连接ID
   */
  async connect(config: McpClientConfig): Promise<string> {
    const connectionId = Buffer.from(config.url).toString('base64');
    
    if (this.connections.has(connectionId)) {
      return connectionId;
    }

    const axios = require('axios').default;
    const eventEmitter = new EventEmitter();
    
    this.connections.set(connectionId, {
      eventSource: eventEmitter,
      requestId: 0,
    });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await axios.post(config.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'muuai-mcp-client',
            version: '1.0.0',
          },
        },
      }, {
        headers,
        responseType: 'stream',
        timeout: config.timeout || 30000,
      });

      const decoder = new (require('util').TextDecoder)('utf-8');
      let buffer = '';

      response.data.on('data', (chunk: Buffer) => {
        buffer += decoder.decode(chunk, { stream: true });
        this.processSSEBuffer(connectionId, buffer);
        buffer = '';
      });

      response.data.on('end', () => {
        eventEmitter.emit('close');
      });

      response.data.on('error', (error: Error) => {
        eventEmitter.emit('error', error);
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('连接超时'));
        }, config.timeout || 30000);

        eventEmitter.once('initialized', () => {
          clearTimeout(timeout);
          resolve();
        });

        eventEmitter.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.logger.log(`MCP Server 连接成功: ${config.url}`);
      return connectionId;
    } catch (error) {
      this.connections.delete(connectionId);
      throw error;
    }
  }

  /**
   * 处理SSE缓冲区
   * @param connectionId 连接ID
   * @param buffer 缓冲区数据
   */
  private processSSEBuffer(connectionId: string, buffer: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const lines = buffer.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(line.trim().substring(6));
          this.handleResponse(connectionId, data);
        } catch {
          this.logger.warn(`解析SSE数据失败: ${line}`);
        }
      }
    }
  }

  /**
   * 处理响应
   * @param connectionId 连接ID
   * @param response 响应数据
   */
  private handleResponse(connectionId: string, response: JsonRpcResponse): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (response.result) {
      const pendingKey = `${connectionId}:${response.id}`;
      const pending = this.pendingRequests.get(pendingKey);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(pendingKey);
        pending.resolve(response.result);
      }

      connection.eventSource.emit('response', response.result);
    }

    if (response.error) {
      const pendingKey = `${connectionId}:${response.id}`;
      const pending = this.pendingRequests.get(pendingKey);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(pendingKey);
        pending.reject(new Error(response.error.message));
      }
    }
  }

  /**
   * 断开连接
   * @param connectionId 连接ID
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.eventSource.emit('close');
      this.connections.delete(connectionId);
      this.logger.log(`MCP Server 连接已断开: ${connectionId}`);
    }
  }

  /**
   * 发送请求
   * @param connectionId 连接ID
   * @param method 方法名
   * @param params 参数
   * @param timeout 超时时间
   * @returns {Promise<unknown>} 响应结果
   */
  async sendRequest(
    connectionId: string,
    method: string,
    params?: Record<string, unknown>,
    timeout: number = 30000,
  ): Promise<unknown> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('连接不存在');
    }

    connection.requestId += 1;
    const requestId = connection.requestId;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(`${connectionId}:${requestId}`);
        reject(new Error('请求超时'));
      }, timeout);

      this.pendingRequests.set(`${connectionId}:${requestId}`, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      connection.eventSource.emit('request', {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params,
      } as JsonRpcRequest);
    });
  }

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

  /**
   * 快速调用MCP工具（无需持久连接）
   * @param config MCP配置
   * @param toolName 工具名称
   * @param args 参数
   * @returns {Promise<unknown>} 执行结果
   */
  async quickCall(
    config: McpClientConfig,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.callTool(config, toolName, args);
  }
}

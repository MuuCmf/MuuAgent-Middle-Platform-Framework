import { ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * MCP 传输协议类型
 */
export type McpTransport = 'http' | 'sse' | 'stdio';

/**
 * MCP 客户端配置接口
 */
export interface McpClientConfig {
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string;
  timeout?: number;
}

/**
 * stdio 进程管理接口
 */
export interface StdioProcess {
  process: ChildProcess;
  client: Client | null;
  lastUsed: number;
}

/**
 * MCP Server 运行时配置接口
 */
export interface McpServerRuntimeConfig {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  transport: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string;
  timeout: number;
  enabled: boolean;
  tools: string[];
  metadata: Record<string, unknown>;
  appCode?: string;
  healthStatus?: string;
}

/**
 * 创建 MCP Server 参数接口
 */
export interface CreateMcpServerParams {
  name: string;
  displayName?: string;
  description?: string;
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string;
  timeout?: number;
  enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  appCode?: string;
  createdBy?: string;
}

/**
 * 更新 MCP Server 参数接口
 */
export interface UpdateMcpServerParams {
  displayName?: string;
  description?: string;
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string | null;
  timeout?: number;
  enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  healthStatus?: string;
  lastSyncAt?: Date;
  lastHealthCheck?: Date;
  updatedBy?: string;
}

/**
 * MCP Server 验证结果接口
 */
export interface McpServerValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证 MCP Server 配置
 * @param transport 传输协议
 * @param url HTTP/SSE URL
 * @param command stdio 命令
 * @returns {McpServerValidationResult} 验证结果
 */
export function validateMcpServerConfig(
  transport: McpTransport,
  url?: string,
  command?: string,
): McpServerValidationResult {
  const errors: string[] = [];

  if (transport === 'http' || transport === 'sse') {
    if (!url) {
      errors.push(`${transport} 协议需要提供 URL`);
    } else {
      try {
        new URL(url);
      } catch {
        errors.push(`URL 格式无效: ${url}`);
      }
    }
  }

  if (transport === 'stdio') {
    if (!command) {
      errors.push('stdio 协议需要提供命令');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * MCP Server配置接口
 */
export interface McpServerConfig {
  name: string
  url: string
  apiKey?: string
  tools?: string[]
  timeout?: number
  enabled?: boolean
}

/**
 * 工具描述接口
 */
export interface ToolDescription {
  name: string
  source: string
  serverName?: string
  description: string
  inputSchema?: Record<string, unknown>
}

/**
 * 发现工具请求接口
 */
export interface DiscoverToolsRequest {
  url: string
  apiKey?: string
  timeout?: number
}

/**
 * 测试连接请求接口
 */
export interface TestConnectionRequest {
  url: string
  apiKey?: string
  toolName?: string
  params?: Record<string, unknown>
  timeout?: number
}

/**
 * 测试连接响应接口
 */
export interface TestConnectionResponse {
  success: boolean
  message: string
  result?: {
    toolCount?: number
    tools?: ToolDescription[]
  }
}

/**
 * 更新智能体MCP Server配置请求接口
 */
export interface UpdateAgentMcpServersRequest {
  mcpServers: McpServerConfig[]
}

/**
 * MCP Server API
 */
export const mcpServerApi = {
  /**
   * 发现MCP Server工具
   * @param data 发现工具请求
   * @returns {Promise<AxiosResponse>} 工具列表
   */
  discoverTools(data: DiscoverToolsRequest): Promise<AxiosResponse<{ data: { tools: ToolDescription[] } }>> {
    return adminRequest.post('/admin/mcp-server/discover', data)
  },

  /**
   * 测试MCP Server连接
   * @param data 测试连接请求
   * @returns {Promise<AxiosResponse>} 测试结果
   */
  testConnection(data: TestConnectionRequest): Promise<AxiosResponse<{ data: TestConnectionResponse }>> {
    return adminRequest.post('/admin/mcp-server/test', data)
  },

  /**
   * 更新智能体MCP Server配置
   * @param agentId 智能体ID
   * @param data 更新配置请求
   * @returns {Promise<AxiosResponse>} 更新结果
   */
  updateAgentMcpServers(
    agentId: number,
    data: UpdateAgentMcpServersRequest
  ): Promise<AxiosResponse<{ data: { message: string; mcpServers: string } }>> {
    return adminRequest.put(`/admin/mcp-server/agent/${agentId}/mcp-servers`, data)
  }
}

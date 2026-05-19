import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * MCP 传输协议类型
 */
export type McpTransport = 'http' | 'sse' | 'stdio'

/**
 * MCP Server 配置接口
 */
export interface McpServerConfig {
  name: string
  transport?: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  apiKey?: string
  tools?: string[]
  timeout?: number
  enabled?: boolean
}

/**
 * MCP Server 响应接口
 */
export interface McpServer {
  id: string
  name: string
  displayName?: string
  description?: string
  transport: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  hasApiKey: boolean
  timeout: number
  enabled: boolean
  tools?: string[]
  healthStatus?: string
  lastSyncAt?: string
  lastHealthCheck?: string
  appCode?: string
  createdAt: string
  updatedAt: string
}

/**
 * 创建 MCP Server 请求接口
 */
export interface CreateMcpServerRequest {
  name: string
  displayName?: string
  description?: string
  transport?: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  apiKey?: string
  timeout?: number
  enabled?: boolean
  tools?: string[]
  metadata?: Record<string, unknown>
  appCode?: string
}

/**
 * 更新 MCP Server 请求接口
 */
export interface UpdateMcpServerRequest {
  displayName?: string
  description?: string
  transport?: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  apiKey?: string | null
  timeout?: number
  enabled?: boolean
  tools?: string[]
  metadata?: Record<string, unknown>
}

/**
 * 查询 MCP Server 请求接口
 */
export interface QueryMcpServerRequest {
  enabled?: boolean
  appCode?: string
  healthStatus?: string
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
  serverId?: string
  transport?: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  apiKey?: string
  timeout?: number
}

/**
 * 测试连接请求接口
 */
export interface TestConnectionRequest {
  serverId?: string
  transport?: McpTransport
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
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
  latency?: number
  result?: {
    toolCount?: number
    tools?: ToolDescription[]
  }
}

/**
 * 健康检查结果接口
 */
export interface HealthCheckResult {
  healthy: boolean
  latency: number
}

/**
 * Claude Desktop MCP Server 配置项
 */
export interface ClaudeMcpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  transport?: string
}

/**
 * 导入 MCP Server 请求接口
 */
export interface ImportMcpServersRequest {
  mcpServers: Record<string, ClaudeMcpServerConfig>
}

/**
 * 导入结果项接口
 */
export interface ImportResultItem {
  name: string
  success: boolean
  error?: string
  server?: McpServer
}

/**
 * 导入结果接口
 */
export interface ImportResult {
  total: number
  success: number
  failed: number
  results: ImportResultItem[]
}

/**
 * MCP Server API
 */
export const mcpServerApi = {
  /**
   * 获取 MCP Server 列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} MCP Server 列表
   */
  getList(params?: QueryMcpServerRequest): Promise<AxiosResponse<{ data: McpServer[] }>> {
    return adminRequest.get('api/admin/mcp-server', { params })
  },

  /**
   * 获取 MCP Server 详情
   * @param id MCP Server ID
   * @returns {Promise<AxiosResponse>} MCP Server 详情
   */
  getById(id: string): Promise<AxiosResponse<{ data: McpServer }>> {
    return adminRequest.get(`api/admin/mcp-server/${id}`)
  },

  /**
   * 创建 MCP Server
   * @param data 创建请求
   * @returns {Promise<AxiosResponse>} 创建的 MCP Server
   */
  create(data: CreateMcpServerRequest): Promise<AxiosResponse<{ data: McpServer }>> {
    return adminRequest.post('api/admin/mcp-server', data)
  },

  /**
   * 更新 MCP Server
   * @param id MCP Server ID
   * @param data 更新请求
   * @returns {Promise<AxiosResponse>} 更新后的 MCP Server
   */
  update(id: string, data: UpdateMcpServerRequest): Promise<AxiosResponse<{ data: McpServer }>> {
    return adminRequest.put(`api/admin/mcp-server/${id}`, data)
  },

  /**
   * 删除 MCP Server
   * @param id MCP Server ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  delete(id: string): Promise<AxiosResponse> {
    return adminRequest.delete(`api/admin/mcp-server/${id}`)
  },

  /**
   * 发现 MCP Server 工具
   * @param data 发现工具请求
   * @returns {Promise<AxiosResponse>} 工具列表
   */
  discoverTools(data: DiscoverToolsRequest): Promise<AxiosResponse<{ data: { tools: ToolDescription[] } }>> {
    return adminRequest.post('api/admin/mcp-server/discover', data)
  },

  /**
   * 同步 MCP Server 工具
   * @param id MCP Server ID
   * @returns {Promise<AxiosResponse>} 同步结果
   */
  syncTools(id: string): Promise<AxiosResponse<{ data: { toolCount: number; tools: ToolDescription[] } }>> {
    return adminRequest.post(`api/admin/mcp-server/${id}/sync`)
  },

  /**
   * 测试 MCP Server 连接
   * @param data 测试连接请求
   * @returns {Promise<AxiosResponse>} 测试结果
   */
  testConnection(data: TestConnectionRequest): Promise<AxiosResponse<{ data: TestConnectionResponse }>> {
    return adminRequest.post('api/admin/mcp-server/test', data)
  },

  /**
   * 测试已注册的 MCP Server 连接
   * @param id MCP Server ID
   * @returns {Promise<AxiosResponse>} 测试结果
   */
  testConnectionById(id: string): Promise<AxiosResponse<{ data: { success: boolean; message: string; latency?: number } }>> {
    return adminRequest.post(`api/admin/mcp-server/${id}/test`)
  },

  /**
   * 健康检查所有 MCP Server
   * @returns {Promise<AxiosResponse>} 健康状态
   */
  healthCheckAll(): Promise<AxiosResponse<{ data: Record<string, HealthCheckResult> }>> {
    return adminRequest.post('api/admin/mcp-server/health-check')
  },

  /**
   * 刷新 MCP Server 缓存
   * @returns {Promise<AxiosResponse>} 刷新结果
   */
  refreshCache(): Promise<AxiosResponse<{ data: { message: string } }>> {
    return adminRequest.post('api/admin/mcp-server/refresh-cache')
  },

  /**
   * 导入 MCP Server（支持 Claude Desktop 配置格式）
   * @param data 导入请求
   * @returns {Promise<AxiosResponse>} 导入结果
   */
  importServers(data: ImportMcpServersRequest): Promise<AxiosResponse<{ data: ImportResult }>> {
    return adminRequest.post('api/admin/mcp-server/import', data)
  }
}

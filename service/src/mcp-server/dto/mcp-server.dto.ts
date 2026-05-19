import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsUrl,
  IsEnum,
  Matches,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { McpTransport } from '../types/mcp-server.types';

/**
 * MCP Server配置DTO
 */
export class McpServerConfigDto {
  @ApiProperty({ description: 'MCP Server名称（用于标识和工具命名前缀）', example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'], default: 'http' })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令（如 npx, uvx, python）' })
  @IsString()
  @IsOptional()
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量' })
  @IsOptional()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '允许使用的工具列表（空数组表示允许所有）', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @ApiPropertyOptional({ description: '超时时间（毫秒）', default: 30000 })
  @IsNumber()
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

/**
 * 创建 MCP Server DTO
 */
export class CreateMcpServerDto {
  @ApiProperty({ description: 'MCP Server名称（唯一标识，用于工具命名前缀）', example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
    message: '名称必须以字母开头，只能包含字母、数字、下划线和连字符',
  })
  name: string;

  @ApiPropertyOptional({ description: '显示名称', example: '文件系统服务' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'], default: 'http' })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址（http/sse协议必填）', example: 'http://localhost:8081/mcp' })
  @ValidateIf((o) => o.transport === 'http' || o.transport === 'sse' || !o.transport)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令（stdio协议必填，如 npx, uvx, python）' })
  @ValidateIf((o) => o.transport === 'stdio')
  @IsString()
  @IsNotEmpty({ message: 'stdio协议需要提供命令' })
  @IsOptional()
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数（JSON数组）', type: [String], example: ['-y', '@modelcontextprotocol/server-filesystem', '/path'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量（JSON对象）', example: { GITHUB_TOKEN: 'ghp_xxx' } })
  @IsOptional()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '超时时间（毫秒）', default: 30000 })
  @IsNumber()
  @Min(1000)
  @Max(300000)
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '允许使用的工具列表（空数组表示允许所有）', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @ApiPropertyOptional({ description: '扩展元数据（JSON对象）' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '所属应用标识（租户隔离）' })
  @IsString()
  @IsOptional()
  appCode?: string;
}

/**
 * 更新 MCP Server DTO
 */
export class UpdateMcpServerDto {
  @ApiPropertyOptional({ description: '显示名称' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'] })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址' })
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令' })
  @IsString()
  @IsOptional()
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量' })
  @IsOptional()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'API密钥（传null清空，传空字符串不更新）' })
  @IsOptional()
  apiKey?: string | null;

  @ApiPropertyOptional({ description: '超时时间（毫秒）' })
  @IsNumber()
  @Min(1000)
  @Max(300000)
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '允许使用的工具列表' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @ApiPropertyOptional({ description: '扩展元数据' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

/**
 * 查询 MCP Server DTO
 */
export class QueryMcpServerDto {
  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '应用标识' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '健康状态', enum: ['healthy', 'unhealthy', 'unknown'] })
  @IsString()
  @IsOptional()
  healthStatus?: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'] })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;
}

/**
 * 发现工具请求DTO
 */
export class DiscoverToolsDto {
  @ApiPropertyOptional({ description: 'MCP Server ID（用于获取已保存的配置）' })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'], default: 'http' })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令' })
  @IsString()
  @IsOptional()
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量' })
  @IsOptional()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '超时时间（毫秒）', default: 30000 })
  @IsNumber()
  @IsOptional()
  timeout?: number;
}

/**
 * 测试连接请求DTO
 */
export class TestConnectionDto {
  @ApiPropertyOptional({ description: 'MCP Server ID（用于获取已保存的配置）' })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({ description: '传输协议', enum: ['http', 'sse', 'stdio'], default: 'http' })
  @IsEnum(['http', 'sse', 'stdio'])
  @IsOptional()
  transport?: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令' })
  @IsString()
  @IsOptional()
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量' })
  @IsOptional()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '工具名称（可选，用于测试工具调用）' })
  @IsString()
  @IsOptional()
  toolName?: string;

  @ApiPropertyOptional({ description: '工具参数' })
  @IsOptional()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '超时时间（毫秒）', default: 30000 })
  @IsNumber()
  @IsOptional()
  timeout?: number;
}

/**
 * 工具描述DTO
 */
export class ToolDescriptionDto {
  @ApiProperty({ description: '工具标识' })
  name: string;

  @ApiProperty({ description: '工具来源：skill | mcp' })
  source: string;

  @ApiPropertyOptional({ description: 'MCP Server名称（仅MCP工具）' })
  serverName?: string;

  @ApiProperty({ description: '工具描述' })
  description: string;

  @ApiPropertyOptional({ description: '参数Schema' })
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP Server 响应 DTO
 */
export class McpServerResponseDto {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '服务器名称' })
  name: string;

  @ApiPropertyOptional({ description: '显示名称' })
  displayName?: string;

  @ApiPropertyOptional({ description: '描述' })
  description?: string;

  @ApiProperty({ description: '传输协议', enum: ['http', 'sse', 'stdio'] })
  transport: McpTransport;

  @ApiPropertyOptional({ description: 'HTTP/SSE端点地址' })
  url?: string;

  @ApiPropertyOptional({ description: 'stdio命令' })
  command?: string;

  @ApiPropertyOptional({ description: 'stdio参数', type: [String] })
  args?: string[];

  @ApiPropertyOptional({ description: '环境变量' })
  env?: Record<string, string>;

  @ApiProperty({ description: '是否已设置 API Key' })
  hasApiKey: boolean;

  @ApiPropertyOptional({ description: '超时时间（毫秒）' })
  timeout: number;

  @ApiProperty({ description: '是否启用' })
  enabled: boolean;

  @ApiPropertyOptional({ description: '允许的工具列表', type: [String] })
  tools?: string[];

  @ApiPropertyOptional({ description: '健康状态' })
  healthStatus?: string;

  @ApiPropertyOptional({ description: '最后同步时间' })
  lastSyncAt?: Date;

  @ApiPropertyOptional({ description: '最后健康检查时间' })
  lastHealthCheck?: Date;

  @ApiPropertyOptional({ description: '所属应用标识' })
  appCode?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * Claude Desktop MCP Server 配置项
 */
export interface ClaudeMcpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
}

/**
 * Claude Desktop 配置格式
 */
export class ImportMcpServersDto {
  @ApiProperty({
    description: 'Claude Desktop 配置格式 JSON',
    example: {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
        },
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'ghp_xxx' },
        },
      },
    },
  })
  @IsOptional()
  mcpServers?: Record<string, ClaudeMcpServerConfig>;
}

/**
 * 导入结果项
 */
export class ImportResultItemDto {
  @ApiProperty({ description: '服务器名称' })
  name: string;

  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;

  @ApiPropertyOptional({ description: '创建的服务器信息' })
  server?: McpServerResponseDto;
}

/**
 * 导入结果 DTO
 */
export class ImportResultDto {
  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '成功数' })
  success: number;

  @ApiProperty({ description: '失败数' })
  failed: number;

  @ApiProperty({ description: '导入结果列表', type: [ImportResultItemDto] })
  results: ImportResultItemDto[];
}

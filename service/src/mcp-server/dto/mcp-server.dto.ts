import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsUrl,
  Matches,
  Min,
  Max,
} from 'class-validator';

/**
 * MCP Server配置DTO
 */
export class McpServerConfigDto {
  @ApiProperty({ description: 'MCP Server名称（用于标识和工具命名前缀）', example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsNotEmpty()
  url: string;

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

  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  url: string;

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

  @ApiPropertyOptional({ description: 'MCP Server HTTP端点地址' })
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsOptional()
  url?: string;

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
}

/**
 * 发现工具请求DTO
 */
export class DiscoverToolsDto {
  @ApiPropertyOptional({ description: 'MCP Server ID（用于获取已保存的 API Key）' })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: 'API密钥（留空则使用已保存的密钥）' })
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
  @ApiPropertyOptional({ description: 'MCP Server ID（用于获取已保存的 API Key）' })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: 'API密钥（留空则使用已保存的密钥）' })
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

  @ApiProperty({ description: 'HTTP端点地址' })
  url: string;

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

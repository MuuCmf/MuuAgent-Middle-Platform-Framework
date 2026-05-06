import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
 * 发现工具请求DTO
 */
export class DiscoverToolsDto {
  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsNotEmpty()
  url: string;

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
  @ApiProperty({ description: 'MCP Server HTTP端点地址', example: 'http://localhost:8081/mcp' })
  @IsString()
  @IsNotEmpty()
  url: string;

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
 * 更新智能体MCP Server配置DTO
 */
export class UpdateAgentMcpServersDto {
  @ApiProperty({ description: 'MCP Server配置列表', type: [McpServerConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McpServerConfigDto)
  mcpServers: McpServerConfigDto[];
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

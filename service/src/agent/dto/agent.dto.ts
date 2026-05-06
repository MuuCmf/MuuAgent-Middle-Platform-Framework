import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

/**
 * 创建智能体DTO
 */
export class CreateAgentDto {
  @ApiProperty({ description: '智能体名称', example: '助手' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '智能体唯一标识', example: 'assistant' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: '智能体描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '系统提示词' })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiPropertyOptional({ description: '绑定模型ID' })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)', example: '["get_weather","get_time"]' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '最大执行步数', default: 5 })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '温度参数', default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * 更新智能体DTO
 */
export class UpdateAgentDto {
  @ApiPropertyOptional({ description: '智能体名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '智能体描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '系统提示词' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '绑定模型ID' })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '最大执行步数' })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '温度参数' })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * Agent对话请求DTO
 */
export class AgentChatDto {
  @ApiProperty({ description: '智能体ID或标识' })
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiProperty({ description: '用户消息' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: '会话ID(用于多轮对话)' })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;

  @ApiPropertyOptional({ description: '是否流式输出', default: false })
  @IsBoolean()
  @IsOptional()
  stream?: boolean;
}

/**
 * 查询智能体列表DTO
 */
export class QueryAgentDto {
  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 自定义模型参数
 */
export interface CustomModelParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextWindow?: number;
}

/**
 * 创建智能体DTO
 */
export class CreateAgentDto {
  @ApiProperty({ description: '智能体名称', example: '助手' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: '智能体唯一标识', example: 'assistant' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: '智能体描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '系统提示词' })
  @IsString()
  @IsNotEmpty()
  systemPrompt!: string;

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)', example: '["weather-skill","database-skill"]' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '绑定的MCP Server名称列表(JSON数组)', example: '["filesystem","github"]' })
  @IsString()
  @IsOptional()
  mcpServers?: string;

  @ApiPropertyOptional({ description: '最大执行步数', default: 5 })
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  // ===== 模型模板配置 =====

  @ApiPropertyOptional({ description: '绑定的模型模板标识' })
  @IsString()
  @IsOptional()
  modelTemplateCode?: string;

  @ApiPropertyOptional({ description: '自定义模型参数(JSON)', example: '{"temperature":0.5,"maxTokens":2000}' })
  @IsString()
  @IsOptional()
  customModelParams?: string;

  // ===== 推理模式配置 =====

  @ApiPropertyOptional({ description: '推理模式: NONE/REACT/PLAN/REFLECT', default: 'NONE', enum: ['NONE', 'REACT', 'PLAN', 'REFLECT'] })
  @IsString()
  @IsOptional()
  reasoningMode?: string;

  @ApiPropertyOptional({ description: '自定义推理提示词' })
  @IsString()
  @IsOptional()
  reasoningPrompt?: string;

  // ===== 知识库检索配置 =====

  @ApiPropertyOptional({
    description: '绑定的知识库列表(JSON数组)',
    example: '["product-docs", "api-reference"]',
  })
  @IsString()
  @IsOptional()
  knowledgeBases?: string;

  @ApiPropertyOptional({
    description: '知识库检索配置(JSON)',
    example: '{"strategy":"HYBRID","autoRetrieval":{"enabled":true,"showSources":true,"trigger":"always"},"toolRetrieval":{"enabled":true,"allowSpecifyKb":true}}',
  })
  @IsString()
  @IsOptional()
  kbRetrievalConfig?: string;

  // ===== 内置工具配置 =====

  @ApiPropertyOptional({
    description: '允许使用的内置工具列表(JSON数组)',
    example: '["http_request","kb_search"]',
  })
  @IsString()
  @IsOptional()
  allowedBuiltinTools?: string;

  @ApiPropertyOptional({ description: '所属应用标识(超级管理员专用)' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '是否公开(公开=所有应用可用)', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
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

  @ApiPropertyOptional({ description: '绑定的技能code列表(JSON数组)' })
  @IsString()
  @IsOptional()
  skills?: string;

  @ApiPropertyOptional({ description: '绑定的MCP Server名称列表(JSON数组)' })
  @IsString()
  @IsOptional()
  mcpServers?: string;

  @ApiPropertyOptional({ description: '最大执行步数' })
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  maxSteps?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  // ===== 模型模板配置 =====

  @ApiPropertyOptional({ description: '绑定的模型模板标识' })
  @IsString()
  @IsOptional()
  modelTemplateCode?: string;

  @ApiPropertyOptional({ description: '自定义模型参数(JSON)', example: '{"temperature":0.5,"maxTokens":2000}' })
  @IsString()
  @IsOptional()
  customModelParams?: string;

  // ===== 推理模式配置 =====

  @ApiPropertyOptional({ description: '推理模式: NONE/REACT/PLAN/REFLECT', enum: ['NONE', 'REACT', 'PLAN', 'REFLECT'] })
  @IsString()
  @IsOptional()
  reasoningMode?: string;

  @ApiPropertyOptional({ description: '自定义推理提示词' })
  @IsString()
  @IsOptional()
  reasoningPrompt?: string;

  // ===== 知识库检索配置 =====

  @ApiPropertyOptional({
    description: '绑定的知识库列表(JSON数组)',
    example: '["product-docs", "api-reference"]',
  })
  @IsString()
  @IsOptional()
  knowledgeBases?: string;

  @ApiPropertyOptional({
    description: '知识库检索配置(JSON)',
    example: '{"strategy":"HYBRID","autoRetrieval":{"enabled":true},"toolRetrieval":{"enabled":true}}',
  })
  @IsString()
  @IsOptional()
  kbRetrievalConfig?: string;

  // ===== 内置工具配置 =====

  @ApiPropertyOptional({
    description: '允许使用的内置工具列表(JSON数组)',
    example: '["http_request","kb_search"]',
  })
  @IsString()
  @IsOptional()
  allowedBuiltinTools?: string;

  @ApiPropertyOptional({ description: '所属应用标识(超级管理员专用)' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '是否公开(公开=所有应用可用)' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

/**
 * Agent对话请求DTO
 */
export class AgentChatDto {
  @ApiProperty({ description: '智能体ID或标识' })
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @ApiProperty({ description: '用户消息' })
  @IsString()
  @IsNotEmpty()
  message!: string;

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

  @ApiPropertyOptional({ description: '是否显示推理过程（调试模式）', default: false })
  @IsBoolean()
  @IsOptional()
  showReasoning?: boolean;

  @ApiPropertyOptional({ description: '指定模型CODE（不传或传"mcp"则MCP自动调度）' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '工作目录上下文' })
  @IsObject()
  @IsOptional()
  workspace?: {
    dirName: string;
    treeSummary: string;
  };
}

/**
 * 查询智能体列表DTO
 */
export class QueryAgentDto {
  @ApiPropertyOptional({ description: '是否启用' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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

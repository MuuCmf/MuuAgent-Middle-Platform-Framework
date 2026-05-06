import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

/**
 * 模型类型枚举
 */
export enum ModelType {
  LLM = 'llm',
  EMBEDDING = 'embedding',
  TTS = 'tts',
  ASR = 'asr',
  IMAGE = 'image',
  MULTIMODAL = 'multimodal',
}

/**
 * 模型提供商枚举
 */
export enum ModelProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
  AZURE = 'azure',
  ALIYUN = 'aliyun',
  TENCENT = 'tencent',
  BAIDU = 'baidu',
  ZHIPU = 'zhipu',
  DEEPSEEK = 'deepseek',
  CUSTOM = 'custom',
}

/**
 * 模型标签枚举
 */
export enum ModelTag {
  CHAT = 'chat',           // 对话
  REASONING = 'reasoning', // 推理
  DRAWING = 'drawing',     // 绘图
  EMBEDDING = 'embedding', // 向量
  VOICE = 'voice',         // 语音
}

/**
 * 模型分类枚举
 */
export enum ModelCategory {
  GENERAL = 'general',       // 通用
  CODE = 'code',             // 编程
  MATH = 'math',             // 数学
  CREATIVE = 'creative',     // 创意
  PROFESSIONAL = 'professional', // 专业
}

/**
 * 创建模型DTO
 */
export class CreateModelDto {
  @ApiProperty({ description: '模型名称', example: 'GPT-4' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '模型唯一标识', example: 'gpt-4' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: '模型类型',
    enum: ModelType,
    example: ModelType.LLM,
  })
  @IsEnum(ModelType)
  type: string;

  @ApiProperty({
    description: '提供商',
    enum: ModelProvider,
    example: ModelProvider.OPENAI,
  })
  @IsEnum(ModelProvider)
  provider: string;

  @ApiProperty({ description: 'API地址', example: 'https://api.openai.com/v1/chat/completions' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '权重', default: 1 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: '最大Token数', default: 4096 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

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

  @ApiPropertyOptional({ description: '模型描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '额外配置(JSON格式)' })
  @IsString()
  @IsOptional()
  config?: string;

  @ApiPropertyOptional({ 
    description: '模型标签(JSON数组)', 
    example: '["chat", "reasoning"]',
    type: [String]
  })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({ 
    description: '模型分类',
    enum: ModelCategory,
    example: ModelCategory.GENERAL
  })
  @IsString()
  @IsOptional()
  category?: string;
}

/**
 * 更新模型DTO
 */
export class UpdateModelDto {
  @ApiPropertyOptional({ description: '模型名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '模型标识' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: '模型类型' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: '提供商' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: 'API地址' })
  @IsString()
  @IsOptional()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'API密钥' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: '权重' })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: '最大Token数' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

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

  @ApiPropertyOptional({ description: '模型描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '额外配置(JSON格式)' })
  @IsString()
  @IsOptional()
  config?: string;

  @ApiPropertyOptional({ description: '模型标签(JSON数组)' })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({ description: '模型分类' })
  @IsString()
  @IsOptional()
  category?: string;
}

/**
 * 查询模型列表DTO
 */
export class QueryModelDto {
  @ApiPropertyOptional({ description: '模型类型' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: '提供商' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '模型标签' })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({ description: '模型分类' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;
}

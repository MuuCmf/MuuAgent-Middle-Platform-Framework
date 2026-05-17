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
import { Transform } from 'class-transformer';

/**
 * 模型类型枚举
 */
export enum TemplateModelType {
  LLM = 'llm',
  EMBEDDING = 'embedding',
  MULTIMODAL = 'multimodal',
}

/**
 * 场景标签枚举
 */
export enum SceneTag {
  CUSTOMER_SERVICE = 'customer_service', // 客服问答
  CREATIVE = 'creative',                 // 创意文案
  VECTOR = 'vector',                     // 向量生成
  MULTIMODAL = 'multimodal',             // 多模态生成
  CODE = 'code',                         // 代码生成
}

/**
 * 创建模型参数模板DTO
 */
export class CreateModelTemplateDto {
  @ApiProperty({ description: '模板名称', example: '客服问答模板' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '模板唯一标识', example: 'customer-service-template' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: '适配模型类型',
    enum: TemplateModelType,
    example: TemplateModelType.LLM,
  })
  @IsEnum(TemplateModelType)
  modelType: string;

  @ApiPropertyOptional({ description: '温度参数', default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '核采样参数', default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  topP?: number;

  @ApiPropertyOptional({ description: '上下文窗口大小', default: 8192 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  contextWindow?: number;

  @ApiPropertyOptional({ description: '最大生成长度', default: 1000 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({
    description: '场景标签',
    enum: SceneTag,
    example: SceneTag.CUSTOMER_SERVICE,
  })
  @IsString()
  @IsOptional()
  sceneTag?: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiPropertyOptional({ description: '是否为默认模板', default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * 更新模型参数模板DTO
 */
export class UpdateModelTemplateDto {
  @ApiPropertyOptional({ description: '模板名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '模板标识' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: '适配模型类型' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiPropertyOptional({ description: '温度参数' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '核采样参数' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  topP?: number;

  @ApiPropertyOptional({ description: '上下文窗口大小' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  contextWindow?: number;

  @ApiPropertyOptional({ description: '最大生成长度' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ description: '场景标签' })
  @IsString()
  @IsOptional()
  sceneTag?: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiPropertyOptional({ description: '是否为默认模板' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * 查询模型参数模板列表DTO
 */
export class QueryModelTemplateDto {
  @ApiPropertyOptional({ description: '适配模型类型' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiPropertyOptional({ description: '场景标签' })
  @IsString()
  @IsOptional()
  sceneTag?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '是否为默认模板' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;
}

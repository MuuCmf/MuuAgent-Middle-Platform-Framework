import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 意图类型枚举
 */
export enum IntentType {
  GENERAL = 'general',
  CODE = 'code',
  MATH = 'math',
  CREATIVE = 'creative',
  PROFESSIONAL = 'professional',
  IMAGE = 'image',
  TTS = 'tts',
  ASR = 'asr',
  S2S = 's2s',
}

/**
 * 创建意图关键词DTO
 */
export class CreateIntentKeywordDto {
  @ApiProperty({ description: '意图类型', enum: IntentType, example: IntentType.CODE })
  @IsString()
  @IsNotEmpty()
  intent: string;

  @ApiProperty({ description: '关键词（支持正则表达式）', example: '代码' })
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @ApiPropertyOptional({ description: '权重', default: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: '是否为正则表达式', default: false })
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '关键词描述' })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 更新意图关键词DTO
 */
export class UpdateIntentKeywordDto {
  @ApiPropertyOptional({ description: '意图类型', enum: IntentType })
  @IsString()
  @IsOptional()
  intent?: string;

  @ApiPropertyOptional({ description: '关键词' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '权重' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: '是否为正则表达式' })
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '关键词描述' })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 查询意图关键词DTO
 */
export class QueryIntentKeywordDto {
  @ApiPropertyOptional({ description: '意图类型', enum: IntentType })
  @IsString()
  @IsOptional()
  intent?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '关键词搜索' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Transform(({ value }) => parseInt(value) || 1)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @Transform(({ value }) => parseInt(value) || 20)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;
}

/**
 * 批量导入关键词DTO
 */
export class BatchImportKeywordDto {
  @ApiProperty({ description: '意图类型', enum: IntentType })
  @IsString()
  @IsNotEmpty()
  intent: string;

  @ApiProperty({ description: '关键词列表', example: ['代码', '编程', 'bug'] })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  keywords: string[];

  @ApiPropertyOptional({ description: '权重', default: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: '是否为正则表达式', default: false })
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;
}
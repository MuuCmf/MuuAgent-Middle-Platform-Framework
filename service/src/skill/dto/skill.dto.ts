import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

/**
 * 技能类型枚举
 */
export enum SkillType {
  HTTP = 'http',
  FUNCTION = 'function',
  DATABASE = 'database',
  RPC = 'rpc',
}

/**
 * 创建技能DTO
 */
export class CreateSkillDto {
  @ApiProperty({ description: '技能名称', example: '查询天气' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '技能唯一标识', example: 'get_weather' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '功能描述(给LLM看)', example: '获取指定城市的天气信息' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: '技能类型',
    enum: SkillType,
    example: SkillType.HTTP,
  })
  @IsEnum(SkillType)
  type: string;

  @ApiProperty({ description: '入参描述(JSON格式)', example: '{"city":{"type":"string","description":"城市名称"}}' })
  @IsString()
  @IsNotEmpty()
  params: string;

  @ApiProperty({ description: '执行配置(JSON格式)' })
  @IsString()
  @IsNotEmpty()
  config: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '超时时间(毫秒)', default: 30000 })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;
}

/**
 * 更新技能DTO
 */
export class UpdateSkillDto {
  @ApiPropertyOptional({ description: '技能名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '功能描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '入参描述(JSON格式)' })
  @IsString()
  @IsOptional()
  params?: string;

  @ApiPropertyOptional({ description: '执行配置(JSON格式)' })
  @IsString()
  @IsOptional()
  config?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '超时时间(毫秒)' })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;
}

/**
 * 执行技能DTO
 */
export class ExecuteSkillDto {
  @ApiProperty({ description: '技能标识', example: 'get_weather' })
  @IsString()
  @IsNotEmpty()
  skillCode: string;

  @ApiProperty({ description: '执行参数(JSON格式)', example: '{"city":"北京"}' })
  params: Record<string, unknown>;
}

/**
 * 查询技能列表DTO
 */
export class QuerySkillDto {
  @ApiPropertyOptional({ description: '技能类型' })
  @IsString()
  @IsOptional()
  type?: string;

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

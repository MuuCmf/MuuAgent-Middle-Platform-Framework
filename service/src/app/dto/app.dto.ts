import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * 创建应用DTO
 */
export class CreateAppDto {
  @ApiProperty({ description: '应用名称', example: '我的应用' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '应用标识', example: 'my-app' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ description: '允许使用的模型(JSON数组)', example: ['gpt-4', 'claude-3'] })
  @IsOptional()
  @IsArray()
  allowedModels?: string[];

  @ApiPropertyOptional({ description: '允许使用的智能体(JSON数组)' })
  @IsOptional()
  @IsArray()
  allowedAgents?: string[];

  @ApiPropertyOptional({ description: '允许使用的技能(JSON数组)' })
  @IsOptional()
  @IsArray()
  allowedSkills?: string[];

  @ApiPropertyOptional({ description: '允许访问的知识库(JSON数组)' })
  @IsOptional()
  @IsArray()
  allowedKbs?: string[];

  @ApiPropertyOptional({ description: 'QPS限制', default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  qpsLimit?: number;

  @ApiPropertyOptional({ description: '每日调用限制', default: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyLimit?: number;

  @ApiPropertyOptional({ description: 'Token配额（月）', default: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  tokenLimit?: number;

  @ApiPropertyOptional({ description: '是否启用OAuth', default: false })
  @IsOptional()
  @IsBoolean()
  enableOAuth?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  @IsDateString()
  expireAt?: string;
}

/**
 * 更新应用DTO
 */
export class UpdateAppDto extends PartialType(CreateAppDto) {}

/**
 * 应用查询DTO
 */
export class QueryAppDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: '应用名称/标识搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '状态筛选' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;
}

/**
 * 重置应用密钥DTO
 */
export class ResetSecretDto {
  @ApiPropertyOptional({ description: '是否同时重置API Key', default: false })
  @IsOptional()
  @IsBoolean()
  resetApiKey?: boolean;
}

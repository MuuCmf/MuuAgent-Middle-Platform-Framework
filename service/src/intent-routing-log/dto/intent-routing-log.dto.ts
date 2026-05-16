import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 查询路由日志DTO
 */
export class QueryRoutingLogDto {
  @ApiPropertyOptional({ description: '意图类型' })
  @IsString()
  @IsOptional()
  intent?: string;

  @ApiPropertyOptional({ description: '模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '是否降级' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isDegraded?: boolean;

  @ApiPropertyOptional({ description: '是否成功' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @ApiPropertyOptional({ description: '分类来源' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: '应用标识' })
  @IsString()
  @IsOptional()
  appCode?: string;

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
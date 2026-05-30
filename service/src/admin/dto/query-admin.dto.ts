import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 查询管理员列表DTO
 */
export class QueryAdminDto {
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
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词搜索（账号/昵称）' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '角色筛选', enum: ['admin', 'ops', 'read'] })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: '状态筛选: 1正常 0禁用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

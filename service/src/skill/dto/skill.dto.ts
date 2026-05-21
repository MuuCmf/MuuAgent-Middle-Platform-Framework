import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 查询标准技能列表DTO
 */
export class QueryStandardSkillDto {
  @ApiPropertyOptional({ description: '应用标识筛选' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '页码，从1开始', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页大小', default: 20 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: '排序字段', enum: ['name', 'description', 'source', 'appCode'], default: 'name' })
  @IsEnum(['name', 'description', 'source', 'appCode'])
  @IsOptional()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'], default: 'asc' })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

/**
 * 分页响应DTO
 */
export class PaginatedResponse<T> {
  @ApiProperty({ description: '数据列表' })
  data: T[];

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页大小' })
  pageSize: number;

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;

  constructor(data: T[], page: number, pageSize: number, total: number) {
    this.data = data;
    this.page = page;
    this.pageSize = pageSize;
    this.total = total;
    this.totalPages = Math.ceil(total / pageSize);
  }
}

/**
 * 验证 SKILL.md DTO
 */
export class ValidateSkillMdDto {
  @ApiProperty({ description: 'SKILL.md 完整内容' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

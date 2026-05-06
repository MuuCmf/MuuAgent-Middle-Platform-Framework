import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 查询知识库列表DTO
 */
export class QueryKbListDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageNum?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

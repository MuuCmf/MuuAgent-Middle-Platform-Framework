import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 查询文档列表DTO
 */
export class QueryDocumentListDto {
  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

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
  docName?: string;
}

import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean, IsIn } from 'class-validator';

/**
 * 更新知识库DTO
 */
export class UpdateKbDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsOptional()
  kbName?: string;

  @IsString()
  @IsOptional()
  embeddingModel?: string;

  @IsNumber()
  @Min(100)
  @Max(2000)
  @IsOptional()
  chunkSize?: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  @IsOptional()
  chunkOverlap?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityThresh?: number;

  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  topN?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsIn(['vector', 'bm25'])
  @IsOptional()
  retrievalMethod?: string;
}

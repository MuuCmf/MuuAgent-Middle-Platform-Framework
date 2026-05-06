import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator';

/**
 * 创建知识库DTO
 */
export class CreateKbDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库名称不能为空' })
  kbName: string;

  @IsString()
  @IsNotEmpty({ message: '知识库标识不能为空' })
  kbCode: string;

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
}

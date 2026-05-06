import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional } from 'class-validator';

/**
 * RAG问答DTO
 */
export class RagChatDto {
  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsNotEmpty({ message: '查询问题不能为空' })
  query: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  topN?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityThresh?: number;

  @IsString()
  @IsOptional()
  uid?: string;
}

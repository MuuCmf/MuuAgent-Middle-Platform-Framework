import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 创建知识库DTO
 */
export class CreateKbDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @ApiProperty({ description: '知识库名称' })
  @IsString()
  @IsNotEmpty({ message: '知识库名称不能为空' })
  kbName: string;

  @ApiProperty({ description: '知识库标识' })
  @IsString()
  @IsNotEmpty({ message: '知识库标识不能为空' })
  kbCode: string;

  @ApiPropertyOptional({ description: '嵌入模型' })
  @IsString()
  @IsOptional()
  embeddingModel?: string;

  @ApiPropertyOptional({ description: '分块大小' })
  @IsNumber()
  @Min(100)
  @Max(2000)
  @IsOptional()
  chunkSize?: number;

  @ApiPropertyOptional({ description: '分块重叠' })
  @IsNumber()
  @Min(0)
  @Max(500)
  @IsOptional()
  chunkOverlap?: number;

  @ApiPropertyOptional({ description: '相似度阈值' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityThresh?: number;

  @ApiPropertyOptional({ description: '返回数量' })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  topN?: number;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '检索方法' })
  @IsIn(['vector', 'bm25'])
  @IsOptional()
  retrievalMethod?: string;

  @ApiPropertyOptional({ description: '所属应用标识(超级管理员专用)' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '是否公开(公开=所有应用可用)', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

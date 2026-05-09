import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ConversationType } from './create-conversation.dto';

/**
 * 查询会话列表DTO
 */
export class QueryConversationDto {
  @ApiPropertyOptional({ description: '会话类型', enum: ConversationType })
  @IsEnum(ConversationType)
  @IsOptional()
  conversationType?: ConversationType;

  @ApiPropertyOptional({ description: '目标ID（智能体ID/模型标识/知识库ID）' })
  @IsString()
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsString()
  @IsOptional()
  uid?: string;

  @ApiPropertyOptional({ description: '会话状态' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Transform(({ value }) => Number(value) || 1)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @Transform(({ value }) => Number(value) || 20)
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}

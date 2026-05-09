import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

/**
 * 会话类型枚举
 */
export enum ConversationType {
  AGENT = 'agent',
  MODEL = 'model',
  KB_RAG = 'kb-rag',
}

/**
 * 创建会话DTO
 */
export class CreateConversationDto {
  @ApiProperty({
    description: '会话类型',
    enum: ConversationType,
    default: ConversationType.AGENT,
  })
  @IsEnum(ConversationType)
  @IsOptional()
  conversationType?: ConversationType;

  @ApiProperty({ description: '目标ID（智能体ID/模型标识/知识库ID）' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiPropertyOptional({ description: '会话标题' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: '用户唯一标识' })
  @IsString()
  @IsOptional()
  uid?: string;
}

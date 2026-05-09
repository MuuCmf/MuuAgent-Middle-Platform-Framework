import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

/**
 * 更新会话DTO
 */
export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '会话标题' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: '会话状态', enum: ['active', 'archived', 'deleted'] })
  @IsEnum(['active', 'archived', 'deleted'])
  @IsOptional()
  status?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';

/**
 * 添加消息DTO
 */
export class AddMessageDto {
  @ApiProperty({ description: '角色', enum: ['user', 'assistant', 'system', 'tool'] })
  @IsEnum(['user', 'assistant', 'system', 'tool'])
  role: string;

  @ApiProperty({ description: '消息内容' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: '工具调用信息(JSON)' })
  @IsOptional()
  toolCalls?: any;

  @ApiPropertyOptional({ description: '工具调用ID' })
  @IsString()
  @IsOptional()
  toolCallId?: string;

  @ApiPropertyOptional({ description: 'Token数量' })
  @IsNumber()
  @IsOptional()
  tokenCount?: number;

  @ApiPropertyOptional({ description: '推理步骤(JSON)' })
  @IsOptional()
  reasoningSteps?: any;

  @ApiPropertyOptional({ description: '额外元数据(JSON)' })
  @IsOptional()
  metadata?: any;
}

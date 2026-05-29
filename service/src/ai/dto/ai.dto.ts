import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';

/**
 * AI调用请求DTO
 */
export class AiInvokeDto {
  @ApiPropertyOptional({ description: '模型类型', default: 'llm' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiPropertyOptional({ description: '指定模型标识(可选)' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiProperty({ description: '提示词/消息内容' })
  @IsNotEmpty()
  messages: Array<{ role: string; content: string }>;

  @ApiPropertyOptional({ description: '温度参数', default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '最大生成Token数' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ description: '额外参数(JSON格式)' })
  @IsOptional()
  extra?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '会话ID(用于多轮对话)' })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;
}

/**
 * Embedding向量生成请求DTO
 */
export class EmbeddingDto {
  @ApiPropertyOptional({ description: '模型类型', default: 'embedding' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiProperty({ description: '输入文本' })
  @IsString()
  @IsNotEmpty()
  input: string;

  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;
}

/**
 * 文生图请求DTO
 */
export class ImageGenerateDto {
  @ApiPropertyOptional({ description: '模型类型', default: 'image' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiProperty({ description: '提示词' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({ description: '图片宽度' })
  @IsNumber()
  @Min(64)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ description: '图片高度' })
  @IsNumber()
  @Min(64)
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ description: '生成数量' })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  n?: number;

  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;
}

/**
 * TTS语音合成请求DTO
 */
export class TtsDto {
  @ApiPropertyOptional({ description: '模型类型', default: 'tts' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiProperty({ description: '输入文本' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ description: '语音ID' })
  @IsString()
  @IsOptional()
  voice?: string;

  @ApiPropertyOptional({ description: '语速' })
  @IsNumber()
  @Min(0.5)
  @Max(2)
  @IsOptional()
  speed?: number;

  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;
}

/**
 * 实时TTS语音合成请求DTO（管理端测试用）
 * 用于触发WebSocket实时流式语音合成
 */
export class TtsRealtimeDto {
  @ApiProperty({ description: '输入文本' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: '会话ID（与WebSocket连接对应）' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiPropertyOptional({ description: '语音ID' })
  @IsString()
  @IsOptional()
  voice?: string;

  @ApiPropertyOptional({ description: '语速' })
  @IsNumber()
  @Min(0.5)
  @Max(2)
  @IsOptional()
  speed?: number;

  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;
}

/**
 * TTS模型能力查询DTO（管理端测试用）
 */
export class TtsCapabilityDto {
  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '语音ID' })
  @IsString()
  @IsOptional()
  voice?: string;
}

/**
 * TTS追加文本合成DTO（管理端测试用）
 * 在已有实时会话中追加文本并触发合成
 */
export class TtsAppendDto {
  @ApiProperty({ description: '追加的文本' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: '会话ID（与实时会话对应）' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

/**
 * ASR语音识别请求DTO
 */
export class AsrDto {
  @ApiPropertyOptional({ description: '模型类型', default: 'asr' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiProperty({ description: '音频数据(Base64)' })
  @IsString()
  @IsNotEmpty()
  audio: string;

  @ApiPropertyOptional({ description: '音频格式' })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiPropertyOptional({ description: '指定模型标识' })
  @IsString()
  @IsOptional()
  modelCode?: string;

  @ApiPropertyOptional({ description: '调用用户唯一标识(透传)' })
  @IsString()
  @IsOptional()
  uid?: string;
}

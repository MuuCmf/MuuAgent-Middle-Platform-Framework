import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * 上传文件 DTO
 */
export class UploadFileDto {
  @ApiPropertyOptional({ description: '业务类型', example: 'kb' })
  @IsString()
  @IsOptional()
  businessType?: string;

  @ApiPropertyOptional({ description: '业务ID', example: 'uuid' })
  @IsString()
  @IsOptional()
  businessId?: string;

  @ApiPropertyOptional({ description: '存储类型', enum: ['local', 'oss', 's3'], default: 'local' })
  @IsString()
  @IsOptional()
  storageType?: string;

  @ApiPropertyOptional({ description: '是否公开', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '是否启用去重', default: false })
  @IsBoolean()
  @IsOptional()
  enableDedup?: boolean;
}

/**
 * 查询文件列表 DTO
 */
export class QueryFileListDto {
  @ApiPropertyOptional({ description: '业务类型', example: 'kb' })
  @IsString()
  @IsOptional()
  businessType?: string;

  @ApiPropertyOptional({ description: '业务ID', example: 'uuid' })
  @IsString()
  @IsOptional()
  businessId?: string;

  @ApiPropertyOptional({ description: '文件类型', enum: ['image', 'video', 'audio', 'pdf', 'doc', 'other'] })
  @IsString()
  @IsOptional()
  fileType?: string;

  @ApiPropertyOptional({ description: '文件名（模糊搜索）', example: 'document' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @Transform(({ value }) => parseInt(value, 10) || 20)
  @IsNumber()
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 文件处理 DTO
 */
export class ProcessFileDto {
  @ApiProperty({ description: '文件ID' })
  @IsString()
  fileId: string;

  @ApiProperty({ description: '处理类型', enum: ['compress', 'convert', 'crop', 'watermark', 'thumbnail', 'resize'] })
  @IsString()
  processType: string;

  @ApiPropertyOptional({ description: '处理配置（JSON格式）' })
  @IsOptional()
  options?: Record<string, any>;
}

/**
 * 删除文件 DTO
 */
export class DeleteFileDto {
  @ApiPropertyOptional({ description: '是否永久删除', default: false })
  @IsBoolean()
  @IsOptional()
  permanent?: boolean;
}

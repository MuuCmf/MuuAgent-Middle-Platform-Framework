import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 变量定义接口
 */
export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

/**
 * 创建 Prompt 模板 DTO
 */
export class CreatePromptTemplateDto {
  @ApiProperty({ description: '模板名称', example: 'RAG问答提示词' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '模板唯一标识', example: 'rag-chat-default' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '分类', enum: ['agent', 'rag', 'react', 'skill', 'custom'], example: 'rag' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Prompt内容（支持变量占位符）', example: '你是一个专业的问答助手...\n\n## 参考信息\n{{context}}\n\n## 用户问题\n{{query}}' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: '变量定义（JSON格式）', type: 'array', example: [{ name: 'context', type: 'string', required: true }] })
  @IsArray()
  @IsOptional()
  variables?: VariableDefinition[];

  @ApiPropertyOptional({ description: '是否默认模板', default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '标签（JSON数组）', type: 'array', example: ['rag', 'qa'] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: '元数据（JSON格式）', type: 'object' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: '创建者' })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({ description: '所属应用标识(超级管理员专用)' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '是否公开(公开=所有应用可用)', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

/**
 * 更新 Prompt 模板 DTO
 */
export class UpdatePromptTemplateDto {
  @ApiPropertyOptional({ description: '模板名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Prompt内容' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: '变量定义', type: 'array' })
  @IsArray()
  @IsOptional()
  variables?: VariableDefinition[];

  @ApiPropertyOptional({ description: '是否默认模板' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '标签', type: 'array' })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: '元数据', type: 'object' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: '变更说明' })
  @IsString()
  @IsOptional()
  changeLog?: string;

  @ApiPropertyOptional({ description: '创建者' })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({ description: '所属应用标识(超级管理员专用)' })
  @IsString()
  @IsOptional()
  appCode?: string;

  @ApiPropertyOptional({ description: '是否公开(公开=所有应用可用)' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

/**
 * 查询 Prompt 模板 DTO
 */
export class QueryPromptTemplateDto {
  @ApiPropertyOptional({ description: '模板标识' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: '模板名称（模糊搜索）' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '分类', enum: ['agent', 'rag', 'react', 'skill', 'custom'] })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: '是否默认模板' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @ApiPropertyOptional({ description: '标签（模糊搜索）' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  pageSize?: number;
}

/**
 * 渲染 Prompt 模板 DTO
 */
export class RenderPromptTemplateDto {
  @ApiProperty({ description: '模板标识', example: 'rag-chat-default' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '变量值', type: 'object', example: { context: '参考信息...', query: '用户问题' } })
  @IsObject()
  variables: Record<string, any>;
}

/**
 * 版本回滚 DTO
 */
export class RollbackPromptTemplateDto {
  @ApiPropertyOptional({ description: '变更说明' })
  @IsString()
  @IsOptional()
  changeLog?: string;

  @ApiPropertyOptional({ description: '创建者' })
  @IsString()
  @IsOptional()
  createdBy?: string;
}

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 上传文档DTO
 */
export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsOptional()
  appCode?: string;
}

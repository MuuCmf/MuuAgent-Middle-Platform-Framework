import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 删除文档DTO
 */
export class DeleteDocumentDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsNotEmpty({ message: '文档ID不能为空' })
  docId: string;
}

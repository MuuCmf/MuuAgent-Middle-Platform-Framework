import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 删除知识库DTO
 */
export class DeleteKbDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;
}

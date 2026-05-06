import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 撤销权限DTO
 */
export class RevokePermissionDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsNotEmpty({ message: '目标用户ID不能为空' })
  targetUid: string;
}

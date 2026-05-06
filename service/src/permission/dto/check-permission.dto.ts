import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { KbPermission } from '../constants/permission.constants';

/**
 * 检查权限DTO
 */
export class CheckPermissionDto {
  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsEnum(KbPermission, { message: '权限类型不正确' })
  permission: KbPermission;
}

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { KbRole } from '../constants/permission.constants';

/**
 * 授予权限DTO
 */
export class GrantPermissionDto {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  uid: string;

  @IsString()
  @IsNotEmpty({ message: '知识库ID不能为空' })
  kbId: string;

  @IsString()
  @IsNotEmpty({ message: '目标用户ID不能为空' })
  targetUid: string;

  @IsEnum(KbRole, { message: '角色类型不正确' })
  role: KbRole;
}

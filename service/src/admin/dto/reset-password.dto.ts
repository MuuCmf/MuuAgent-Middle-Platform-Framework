import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 重置密码DTO（管理员为其他管理员重置密码）
 */
export class ResetPasswordDto {
  @ApiProperty({ description: '新密码', example: 'newpassword123' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于6位' })
  newPassword: string;
}

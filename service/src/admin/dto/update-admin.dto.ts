import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEmail,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 更新管理员DTO
 */
export class UpdateAdminDto {
  @ApiPropertyOptional({ description: '昵称', example: '管理员' })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'admin@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: '角色',
    enum: ['admin', 'ops', 'read'],
  })
  @IsString()
  @IsIn(['admin', 'ops', 'read'], { message: '角色只能是 admin、ops 或 read' })
  @IsOptional()
  role?: string;
}

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth Token 请求 DTO
 */
export class OAuthTokenDto {
  @ApiProperty({ description: '授权类型', example: 'client_credentials' })
  @IsString()
  @IsNotEmpty()
  grant_type: string;

  @ApiProperty({ description: '客户端 ID' })
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @ApiProperty({ description: '客户端密钥' })
  @IsString()
  @IsNotEmpty()
  client_secret: string;

  @ApiProperty({ description: '刷新令牌（refresh_token 模式必填）', required: false })
  @IsString()
  @IsOptional()
  refresh_token?: string;
}

/**
 * OAuth Revoke 请求 DTO
 */
export class OAuthRevokeDto {
  @ApiProperty({ description: '要撤销的令牌' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
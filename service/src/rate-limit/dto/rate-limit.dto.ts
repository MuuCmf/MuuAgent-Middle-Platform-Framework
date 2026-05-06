import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

/**
 * 限流级别枚举
 */
export enum RateLimitLevel {
  GLOBAL = 'global',
  APP = 'app',
  INTERFACE = 'interface',
  MODEL = 'model',
}

/**
 * 创建限流规则DTO
 */
export class CreateRateLimitRuleDto {
  @ApiProperty({
    description: '限流级别',
    enum: RateLimitLevel,
    example: RateLimitLevel.GLOBAL,
  })
  @IsEnum(RateLimitLevel)
  @IsNotEmpty()
  level: string;

  @ApiProperty({ description: '限流目标', example: 'global' })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiPropertyOptional({ description: 'QPS限制', default: 100 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  qpsLimit?: number;

  @ApiPropertyOptional({ description: '并发限制', default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  concurrentLimit?: number;

  @ApiPropertyOptional({ description: '每日调用限制', default: 10000 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  dailyLimit?: number;

  @ApiPropertyOptional({ description: '突发流量大小', default: 20 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  burstSize?: number;

  @ApiPropertyOptional({ description: '是否启用队列', default: false })
  @IsBoolean()
  @IsOptional()
  enableQueue?: boolean;

  @ApiPropertyOptional({ description: '队列大小', default: 100 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  queueSize?: number;

  @ApiPropertyOptional({ description: '队列超时时间(毫秒)', default: 5000 })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  queueTimeout?: number;
}

/**
 * 更新限流规则DTO
 */
export class UpdateRateLimitRuleDto {
  @ApiPropertyOptional({ description: 'QPS限制' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  qpsLimit?: number;

  @ApiPropertyOptional({ description: '并发限制' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  concurrentLimit?: number;

  @ApiPropertyOptional({ description: '每日调用限制' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  dailyLimit?: number;

  @ApiPropertyOptional({ description: '突发流量大小' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  burstSize?: number;

  @ApiPropertyOptional({ description: '是否启用队列' })
  @IsBoolean()
  @IsOptional()
  enableQueue?: boolean;

  @ApiPropertyOptional({ description: '队列大小' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  queueSize?: number;

  @ApiPropertyOptional({ description: '队列超时时间(毫秒)' })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  queueTimeout?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}

/**
 * 添加黑名单DTO
 */
export class AddBlacklistDto {
  @ApiProperty({ description: '客户端IP' })
  @IsString()
  @IsNotEmpty()
  clientIp: string;

  @ApiProperty({ description: '封禁原因' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: '封禁时长(秒)', default: 3600 })
  @IsNumber()
  @Min(60)
  @IsOptional()
  duration?: number;
}

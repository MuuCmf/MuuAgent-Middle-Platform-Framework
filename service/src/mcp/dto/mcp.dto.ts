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
 * 调度策略枚举
 */
export enum StrategyType {
  WEIGHT = 'weight',
  RANDOM = 'random',
  ROUND_ROBIN = 'round_robin',
  FAILOVER = 'failover',
}

/**
 * 熔断状态枚举
 */
export enum CircuitStatus {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * 创建MCP策略DTO
 */
export class CreateMcpStrategyDto {
  @ApiProperty({ description: '模型类型', example: 'llm' })
  @IsString()
  @IsNotEmpty()
  modelType: string;

  @ApiProperty({
    description: '调度策略',
    enum: StrategyType,
    example: StrategyType.WEIGHT,
  })
  @IsEnum(StrategyType)
  strategy: string;

  @ApiPropertyOptional({ description: '重试次数', default: 3 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  retryCount?: number;

  @ApiPropertyOptional({ description: '超时时间(毫秒)', default: 30000 })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '降级模型ID' })
  @IsString()
  @IsOptional()
  fallbackModelId?: string;

  @ApiPropertyOptional({ description: '是否启用熔断', default: true })
  @IsBoolean()
  @IsOptional()
  enableCircuit?: boolean;

  @ApiPropertyOptional({ description: '熔断错误阈值', default: 5 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  circuitThreshold?: number;

  @ApiPropertyOptional({ description: '熔断恢复时间(毫秒)', default: 300000 })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  circuitTimeout?: number;
}

/**
 * 更新MCP策略DTO
 */
export class UpdateMcpStrategyDto {
  @ApiPropertyOptional({ description: '调度策略' })
  @IsEnum(StrategyType)
  @IsOptional()
  strategy?: string;

  @ApiPropertyOptional({ description: '重试次数' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  retryCount?: number;

  @ApiPropertyOptional({ description: '超时时间(毫秒)' })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: '降级模型ID' })
  @IsString()
  @IsOptional()
  fallbackModelId?: string;

  @ApiPropertyOptional({ description: '是否启用熔断' })
  @IsBoolean()
  @IsOptional()
  enableCircuit?: boolean;

  @ApiPropertyOptional({ description: '熔断错误阈值' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  circuitThreshold?: number;

  @ApiPropertyOptional({ description: '熔断恢复时间(毫秒)' })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  circuitTimeout?: number;
}

/**
 * 创建MCP规则DTO
 */
export class CreateMcpRuleDto {
  @ApiProperty({ description: '模型ID' })
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @ApiPropertyOptional({ description: 'QPS限制', default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  qpsLimit?: number;

  @ApiPropertyOptional({ description: '最大并发数', default: 5 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConcurrent?: number;
}

/**
 * 更新MCP规则DTO
 */
export class UpdateMcpRuleDto {
  @ApiPropertyOptional({ description: 'QPS限制' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  qpsLimit?: number;

  @ApiPropertyOptional({ description: '最大并发数' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConcurrent?: number;
}

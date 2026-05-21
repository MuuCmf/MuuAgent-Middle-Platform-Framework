import { ApiProperty } from '@nestjs/swagger';

/**
 * 内置工具信息DTO
 */
export class BuiltinToolDto {
  @ApiProperty({ description: '工具名称', example: 'http_request' })
  name!: string;

  @ApiProperty({ description: '显示名称', example: 'HTTP请求' })
  displayName!: string;

  @ApiProperty({ description: '工具描述', example: '发送HTTP请求访问外部API' })
  description!: string;

  @ApiProperty({ description: '工具分类', example: '网络' })
  category!: string;

  @ApiProperty({ description: '是否敏感工具', example: false })
  sensitive!: boolean;

  @ApiProperty({ description: '工具图标', example: 'Connection', required: false })
  icon?: string;

  @ApiProperty({ description: '参数定义', required: false })
  parameters?: Record<string, any>;

  @ApiProperty({ description: '使用示例', required: false, type: [String] })
  examples?: string[];

  @ApiProperty({ description: '是否启用', example: true })
  enabled!: boolean;
}

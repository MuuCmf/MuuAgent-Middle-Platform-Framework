import { ApiProperty } from '@nestjs/swagger';

/**
 * 统一响应格式类
 * 所有API返回格式统一
 */
export class ApiResponse<T> {
  @ApiProperty({ description: '状态码', example: 200 })
  code: number;

  @ApiProperty({ description: '消息', example: 'success' })
  message: string;

  @ApiProperty({ description: '数据' })
  data: T;

  @ApiProperty({ description: '时间戳' })
  timestamp: string;
}

/**
 * 分页响应数据格式
 */
export class PageData<T> {
  @ApiProperty({ description: '数据列表' })
  list: T[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  pageSize: number;
}

/**
 * 成功响应工厂函数
 * @param data 响应数据
 * @param message 响应消息
 * @returns {ApiResponse<T>} 统一响应对象
 */
export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 失败响应工厂函数
 * @param code 错误码
 * @param message 错误消息
 * @param data 额外数据
 * @returns {ApiResponse<null | Record<string, unknown>>} 统一响应对象
 */
export function fail(
  code: number,
  message: string,
  data?: Record<string, unknown>,
): ApiResponse<null | Record<string, unknown>> {
  return {
    code,
    message,
    data: data || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 分页响应工厂函数
 * @param list 数据列表
 * @param total 总数
 * @param page 当前页
 * @param pageSize 每页数量
 * @returns {ApiResponse<PageData<T>>} 分页响应对象
 */
export function page<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): ApiResponse<PageData<T>> {
  return success({
    list,
    total,
    page,
    pageSize,
  });
}

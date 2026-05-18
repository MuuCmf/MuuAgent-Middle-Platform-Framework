import { ErrorCode } from './error-code';
import { 
  BusinessException, 
  NotFoundException, 
  InvalidParamsException,
  PermissionDeniedException,
} from './business.exception';

/**
 * 断言工具类
 * 
 * 提供便捷的条件检查方法，失败时抛出对应异常
 * 
 * @example
 * ```ts
 * Assert.notNull(agent, '智能体不存在');
 * Assert.isTrue(user.status, '用户已禁用');
 * Assert.hasPermission(user.role === 'admin', '需要管理员权限');
 * ```
 */
export class Assert {
  /**
   * 断言值不为null/undefined
   * @param value 要检查的值
   * @param message 错误消息
   * @param code 错误码
   * @throws BusinessException 如果值为null/undefined
   */
  static notNull<T>(
    value: T | null | undefined,
    message: string,
    code: ErrorCode = ErrorCode.NOT_FOUND,
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new BusinessException(code, message);
    }
  }

  /**
   * 断言条件为true
   * @param condition 条件
   * @param message 错误消息
   * @param code 错误码
   * @throws BusinessException 如果条件为false
   */
  static isTrue(
    condition: boolean,
    message: string,
    code: ErrorCode = ErrorCode.INVALID_PARAMS,
  ): void {
    if (!condition) {
      throw new BusinessException(code, message);
    }
  }

  /**
   * 断言条件为false
   * @param condition 条件
   * @param message 错误消息
   * @param code 错误码
   * @throws BusinessException 如果条件为true
   */
  static isFalse(
    condition: boolean,
    message: string,
    code: ErrorCode = ErrorCode.INVALID_PARAMS,
  ): void {
    if (condition) {
      throw new BusinessException(code, message);
    }
  }

  /**
   * 断言字符串不为空
   * @param value 字符串值
   * @param message 错误消息
   * @param code 错误码
   * @throws BusinessException 如果字符串为空
   */
  static notEmpty(
    value: string | null | undefined,
    message: string,
    code: ErrorCode = ErrorCode.INVALID_PARAMS,
  ): void {
    if (!value || value.trim().length === 0) {
      throw new BusinessException(code, message);
    }
  }

  /**
   * 断言数组不为空
   * @param value 数组
   * @param message 错误消息
   * @param code 错误码
   * @throws BusinessException 如果数组为空
   */
  static notEmptyArray<T>(
    value: T[] | null | undefined,
    message: string,
    code: ErrorCode = ErrorCode.INVALID_PARAMS,
  ): void {
    if (!value || value.length === 0) {
      throw new BusinessException(code, message);
    }
  }

  /**
   * 断言有权限
   * @param hasPermission 是否有权限
   * @param message 错误消息
   * @throws PermissionDeniedException 如果没有权限
   */
  static hasPermission(hasPermission: boolean, message: string = '权限不足'): void {
    if (!hasPermission) {
      throw new PermissionDeniedException(message);
    }
  }

  /**
   * 断言资源存在
   * @param value 资源值
   * @param resourceName 资源名称
   * @param identifier 资源标识
   * @throws NotFoundException 如果资源不存在
   */
  static exists<T>(
    value: T | null | undefined,
    resourceName: string,
    identifier?: string | number,
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new NotFoundException(resourceName, identifier);
    }
  }

  /**
   * 断言数字在范围内
   * @param value 数字值
   * @param min 最小值
   * @param max 最大值
   * @param message 错误消息
   * @throws InvalidParamsException 如果不在范围内
   */
  static inRange(
    value: number,
    min: number,
    max: number,
    message?: string,
  ): void {
    if (value < min || value > max) {
      throw new InvalidParamsException(
        message || `值 ${value} 不在范围 [${min}, ${max}] 内`,
        { value, min, max },
      );
    }
  }

  /**
   * 断言是有效枚举值
   * @param value 值
   * @param enumObj 枚举对象
   * @param message 错误消息
   * @throws InvalidParamsException 如果不是有效枚举值
   */
  static isValidEnum<T extends Record<string, string | number>>(
    value: unknown,
    enumObj: T,
    message?: string,
  ): void {
    const validValues = Object.values(enumObj);
    if (!validValues.includes(value as T[keyof T])) {
      throw new InvalidParamsException(
        message || `无效的枚举值: ${value}`,
        { value, validValues },
      );
    }
  }
}

/**
 * 错误处理工具函数
 */
export class ErrorUtils {
  /**
   * 安全执行函数，捕获异常并返回默认值
   * @param fn 要执行的函数
   * @param defaultValue 默认值
   * @returns 执行结果或默认值
   */
  static async safeAsync<T>(
    fn: () => Promise<T>,
    defaultValue: T,
  ): Promise<T> {
    try {
      return await fn();
    } catch {
      return defaultValue;
    }
  }

  /**
   * 安全执行同步函数，捕获异常并返回默认值
   * @param fn 要执行的函数
   * @param defaultValue 默认值
   * @returns 执行结果或默认值
   */
  static safe<T>(fn: () => T, defaultValue: T): T {
    try {
      return fn();
    } catch {
      return defaultValue;
    }
  }

  /**
   * 重试执行函数
   * @param fn 要执行的函数
   * @param maxRetries 最大重试次数
   * @param delayMs 重试间隔（毫秒）
   * @returns 执行结果
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error('重试失败');
  }

  /**
   * 包装错误为业务异常
   * @param error 原始错误
   * @param code 错误码
   * @param message 自定义消息
   * @returns 业务异常
   */
  static wrap(error: unknown, code: ErrorCode, message?: string): BusinessException {
    if (error instanceof BusinessException) {
      return error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    return new BusinessException(code, message || err.message, undefined, err);
  }

  /**
   * 判断是否为业务异常
   */
  static isBusinessException(error: unknown): error is BusinessException {
    return error instanceof BusinessException;
  }

  /**
   * 判断是否为特定错误码
   */
  static isErrorCode(error: unknown, code: ErrorCode): boolean {
    return error instanceof BusinessException && error.code === code;
  }
}

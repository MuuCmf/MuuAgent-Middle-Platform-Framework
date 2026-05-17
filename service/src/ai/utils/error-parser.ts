/**
 * AI SDK 错误解析工具
 *
 * 用于从 AI SDK 的各种错误类型（RetryError, APICallError 等）中提取友好的错误信息
 */

/**
 * 解析 AI SDK 错误为用户友好的消息
 * @param error 原始错误对象
 * @returns {string} 用户友好的错误消息
 */
export function parseAiError(error: unknown): string {
  if (!error) {
    return '未知错误';
  }

  // 尝试解析为对象
  const errorObj = error as any;

  // RetryError: 重试耗尽错误
  if (errorObj.reason === 'maxRetriesExceeded' && errorObj.errors?.length > 0) {
    const lastError = errorObj.errors[errorObj.errors.length - 1];
    const detail = extractApiErrorDetail(lastError);
    return `模型调用重试失败: ${detail}`;
  }

  // APICallError: API 调用错误
  if (errorObj.statusCode || errorObj.responseBody) {
    return extractApiErrorDetail(errorObj);
  }

  // 标准错误对象
  if (error instanceof Error) {
    return error.message;
  }

  // 字符串错误
  if (typeof error === 'string') {
    return error;
  }

  // 其他情况
  return String(error);
}

/**
 * 从 APICallError 中提取详细信息
 * @param error APICallError 对象
 * @returns {string} 详细错误信息
 */
function extractApiErrorDetail(error: any): string {
  if (!error) {
    return '未知 API 错误';
  }

  const statusCode = error.statusCode;
  const responseBody = error.responseBody;

  // 尝试解析响应体中的错误信息
  if (responseBody) {
    try {
      const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;

      // 智谱 GLM 错误格式
      if (parsed.error?.message) {
        return parsed.error.message;
      }

      // OpenAI 错误格式
      if (parsed.error?.error?.message) {
        return parsed.error.error.message;
      }

      // 通用错误格式
      if (parsed.message) {
        return parsed.message;
      }

      if (parsed.error) {
        return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
      }
    } catch {
      // JSON 解析失败，使用原始响应
    }
  }

  // 根据 HTTP 状态码返回友好提示
  if (statusCode) {
    switch (statusCode) {
      case 400:
        return '请求参数错误，请检查输入内容';
      case 401:
        return 'API 密钥无效或已过期，请联系管理员';
      case 403:
        return '无权访问该模型，请检查权限配置';
      case 404:
        return '模型不存在或已被下线';
      case 429:
        return '模型当前访问量过大，请稍后再试';
      case 500:
        return '模型服务内部错误，请稍后再试';
      case 502:
      case 503:
      case 504:
        return '模型服务暂时不可用，请稍后再试';
      default:
        return `API 调用失败 (${statusCode})`;
    }
  }

  // 使用错误消息
  if (error.message) {
    return error.message;
  }

  return 'API 调用失败';
}

/**
 * 判断错误是否为可重试错误
 * @param error 错误对象
 * @returns {boolean} 是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const errorObj = error as any;

  // RetryError
  if (errorObj.reason === 'maxRetriesExceeded') {
    return true;
  }

  // 429 和 5xx 错误通常可重试
  const statusCode = errorObj.statusCode;
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    return true;
  }

  // 检查 isRetryable 标志
  if (errorObj.isRetryable === true) {
    return true;
  }

  return false;
}

/**
 * 获取错误代码（用于前端分类处理）
 * @param error 错误对象
 * @returns {string} 错误代码
 */
export function getErrorCode(error: unknown): string {
  if (!error) return 'UNKNOWN';

  const errorObj = error as any;

  // RetryError
  if (errorObj.reason === 'maxRetriesExceeded') {
    return 'MAX_RETRIES_EXCEEDED';
  }

  const statusCode = errorObj.statusCode;
  if (statusCode) {
    switch (statusCode) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      default:
        if (statusCode >= 500) {
          return 'SERVER_ERROR';
        }
        return 'API_ERROR';
    }
  }

  return 'UNKNOWN';
}

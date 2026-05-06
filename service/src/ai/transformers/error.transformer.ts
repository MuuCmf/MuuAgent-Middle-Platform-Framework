import { Injectable } from '@nestjs/common';
import {
  UnifiedErrorCode,
  UnifiedErrorResponse,
  ProviderErrorCodeMapping,
  getErrorMessage,
  isRetryableError,
} from '../constants/error-codes';

/**
 * 错误码转换器
 * 将不同厂商的错误转换为统一错误码
 */
@Injectable()
export class ErrorTransformer {
  /**
   * 转换错误为统一格式
   * @param provider 提供商
   * @param error 原始错误
   * @returns {UnifiedErrorResponse} 统一错误响应
   */
  transformError(provider: string, error: any): UnifiedErrorResponse {
    const providerLower = provider.toLowerCase();
    const axiosError = error.response?.data || error;
    const statusCode = error.response?.status;

    let unifiedCode = UnifiedErrorCode.MODEL_ERROR;
    let providerCode = axiosError.error?.code || axiosError.code || statusCode;
    let providerMessage = axiosError.error?.message || axiosError.message || error.message;

    if (statusCode === 401) {
      unifiedCode = UnifiedErrorCode.INVALID_API_KEY;
    } else if (statusCode === 429) {
      unifiedCode = UnifiedErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (statusCode === 404) {
      unifiedCode = UnifiedErrorCode.MODEL_NOT_FOUND;
    } else if (statusCode === 503) {
      unifiedCode = UnifiedErrorCode.MODEL_UNAVAILABLE;
    } else if (statusCode >= 500) {
      unifiedCode = UnifiedErrorCode.MODEL_ERROR;
    } else if (statusCode >= 400) {
      unifiedCode = UnifiedErrorCode.INVALID_REQUEST;
    }

    const mapping = ProviderErrorCodeMapping[providerLower as keyof typeof ProviderErrorCodeMapping];
    if (mapping && providerCode) {
      const providerCodeStr = String(providerCode).toLowerCase();
      for (const [key, value] of Object.entries(mapping)) {
        if (providerCodeStr.includes(key.toLowerCase())) {
          unifiedCode = value as UnifiedErrorCode;
          break;
        }
      }
    }

    if (providerLower === 'ollama') {
      if (error.code === 'ECONNREFUSED') {
        unifiedCode = UnifiedErrorCode.MODEL_UNAVAILABLE;
        providerMessage = 'Ollama服务未启动或连接失败';
      } else if (providerMessage?.includes('model not found')) {
        unifiedCode = UnifiedErrorCode.MODEL_NOT_FOUND;
      }
    }

    const retryable = isRetryableError(unifiedCode);
    const retryAfter = this.extractRetryAfter(error);

    return {
      code: unifiedCode,
      message: getErrorMessage(unifiedCode),
      details: providerMessage,
      providerCode,
      providerMessage,
      retryable,
      retryAfter,
    };
  }

  /**
   * 提取重试等待时间
   * @param error 错误对象
   * @returns {number | undefined} 重试等待时间(秒)
   */
  private extractRetryAfter(error: any): number | undefined {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? undefined : seconds;
    }
    return undefined;
  }

  /**
   * 创建统一错误响应
   * @param code 错误码
   * @param details 错误详情
   * @param providerCode 提供商错误码
   * @param providerMessage 提供商错误消息
   * @returns {UnifiedErrorResponse} 统一错误响应
   */
  createErrorResponse(
    code: UnifiedErrorCode,
    details?: string,
    providerCode?: string | number,
    providerMessage?: string,
  ): UnifiedErrorResponse {
    return {
      code,
      message: getErrorMessage(code),
      details,
      providerCode,
      providerMessage,
      retryable: isRetryableError(code),
    };
  }

  /**
   * 判断是否为限流错误
   * @param error 错误对象
   * @returns {boolean} 是否为限流错误
   */
  isRateLimitError(error: any): boolean {
    return error?.response?.status === 429;
  }

  /**
   * 判断是否为认证错误
   * @param error 错误对象
   * @returns {boolean} 是否为认证错误
   */
  isAuthenticationError(error: any): boolean {
    return error?.response?.status === 401;
  }

  /**
   * 判断是否为模型不可用错误
   * @param error 错误对象
   * @returns {boolean} 是否为模型不可用错误
   */
  isModelUnavailableError(error: any): boolean {
    const status = error?.response?.status;
    return status === 503 || status === 502 || status === 504;
  }

  /**
   * 判断是否为超时错误
   * @param error 错误对象
   * @returns {boolean} 是否为超时错误
   */
  isTimeoutError(error: any): boolean {
    return error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
  }

  /**
   * 判断是否为网络错误
   * @param error 错误对象
   * @returns {boolean} 是否为网络错误
   */
  isNetworkError(error: any): boolean {
    return (
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ECONNRESET' ||
      error?.code === 'ETIMEDOUT'
    );
  }
}

/**
 * AI统一错误码定义
 * 屏蔽不同厂商的错误码差异
 */

/**
 * 统一错误码枚举
 */
export enum UnifiedErrorCode {
  // 成功
  SUCCESS = 0,

  // 客户端错误 (1000-1999)
  INVALID_REQUEST = 1000,
  INVALID_PARAMETER = 1001,
  MISSING_PARAMETER = 1002,
  INVALID_MODEL = 1003,
  MODEL_NOT_FOUND = 1004,
  UNSUPPORTED_MODEL_TYPE = 1005,

  // 认证授权错误 (2000-2999)
  UNAUTHORIZED = 2000,
  INVALID_API_KEY = 2001,
  API_KEY_EXPIRED = 2002,
  INSUFFICIENT_PERMISSIONS = 2003,

  // 限流错误 (3000-3999)
  RATE_LIMIT_EXCEEDED = 3000,
  QUOTA_EXCEEDED = 3001,
  CONCURRENT_LIMIT_EXCEEDED = 3002,
  DAILY_LIMIT_EXCEEDED = 3003,

  // 熔断错误 (4000-4999)
  CIRCUIT_BREAKER_OPEN = 4000,
  MODEL_CIRCUIT_OPEN = 4001,
  TOO_MANY_FAILURES = 4002,

  // 模型调用错误 (5000-5999)
  MODEL_ERROR = 5000,
  MODEL_TIMEOUT = 5001,
  MODEL_UNAVAILABLE = 5002,
  MODEL_OVERLOADED = 5003,
  CONTEXT_LENGTH_EXCEEDED = 5004,
  CONTENT_FILTER = 5005,

  // 服务端错误 (9000-9999)
  INTERNAL_ERROR = 9000,
  DATABASE_ERROR = 9001,
  NETWORK_ERROR = 9002,
  UNKNOWN_ERROR = 9999,
}

/**
 * 统一错误响应接口
 */
export interface UnifiedErrorResponse {
  /** 错误码 */
  code: UnifiedErrorCode;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: string;
  /** 提供商错误码(可选) */
  providerCode?: string | number;
  /** 提供商错误消息(可选) */
  providerMessage?: string;
  /** 重试建议 */
  retryable?: boolean;
  /** 重试等待时间(秒) */
  retryAfter?: number;
}

/**
 * 提供商错误码映射配置
 */
export const ProviderErrorCodeMapping = {
  openai: {
    'invalid_api_key': UnifiedErrorCode.INVALID_API_KEY,
    'insufficient_quota': UnifiedErrorCode.QUOTA_EXCEEDED,
    'rate_limit_exceeded': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    'model_not_found': UnifiedErrorCode.MODEL_NOT_FOUND,
    'context_length_exceeded': UnifiedErrorCode.CONTEXT_LENGTH_EXCEEDED,
    'content_filter': UnifiedErrorCode.CONTENT_FILTER,
  },
  anthropic: {
    'invalid_api_key': UnifiedErrorCode.INVALID_API_KEY,
    'rate_limit_error': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    'overloaded_error': UnifiedErrorCode.MODEL_OVERLOADED,
    'context_length_exceeded': UnifiedErrorCode.CONTEXT_LENGTH_EXCEEDED,
  },
  ollama: {
    'model not found': UnifiedErrorCode.MODEL_NOT_FOUND,
    'connection refused': UnifiedErrorCode.MODEL_UNAVAILABLE,
  },
  deepseek: {
    'invalid_api_key': UnifiedErrorCode.INVALID_API_KEY,
    'rate_limit': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    'insufficient_quota': UnifiedErrorCode.QUOTA_EXCEEDED,
  },
  zhipu: {
    'invalid_api_key': UnifiedErrorCode.INVALID_API_KEY,
    'rate_limit': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    'model_not_found': UnifiedErrorCode.MODEL_NOT_FOUND,
  },
  aliyun: {
    'InvalidApiKey': UnifiedErrorCode.INVALID_API_KEY,
    'Throttling': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    'ModelNotFound': UnifiedErrorCode.MODEL_NOT_FOUND,
  },
  tencent: {
    'InvalidApiKey': UnifiedErrorCode.INVALID_API_KEY,
    'RequestLimitExceeded': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
  },
  volcengine: {
    'InvalidApiKey': UnifiedErrorCode.INVALID_API_KEY,
    'RateLimitExceeded': UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
  },
};

/**
 * 错误码消息映射
 */
export const ErrorCodeMessages: Record<UnifiedErrorCode, string> = {
  [UnifiedErrorCode.SUCCESS]: '成功',
  
  [UnifiedErrorCode.INVALID_REQUEST]: '无效的请求',
  [UnifiedErrorCode.INVALID_PARAMETER]: '无效的参数',
  [UnifiedErrorCode.MISSING_PARAMETER]: '缺少必要参数',
  [UnifiedErrorCode.INVALID_MODEL]: '无效的模型',
  [UnifiedErrorCode.MODEL_NOT_FOUND]: '模型不存在',
  [UnifiedErrorCode.UNSUPPORTED_MODEL_TYPE]: '不支持的模型类型',
  
  [UnifiedErrorCode.UNAUTHORIZED]: '未授权',
  [UnifiedErrorCode.INVALID_API_KEY]: '无效的API密钥',
  [UnifiedErrorCode.API_KEY_EXPIRED]: 'API密钥已过期',
  [UnifiedErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',
  
  [UnifiedErrorCode.RATE_LIMIT_EXCEEDED]: '请求频率超限',
  [UnifiedErrorCode.QUOTA_EXCEEDED]: '配额已用尽',
  [UnifiedErrorCode.CONCURRENT_LIMIT_EXCEEDED]: '并发数超限',
  [UnifiedErrorCode.DAILY_LIMIT_EXCEEDED]: '每日限额已用尽',
  
  [UnifiedErrorCode.CIRCUIT_BREAKER_OPEN]: '熔断器已打开',
  [UnifiedErrorCode.MODEL_CIRCUIT_OPEN]: '模型熔断中',
  [UnifiedErrorCode.TOO_MANY_FAILURES]: '错误次数过多',
  
  [UnifiedErrorCode.MODEL_ERROR]: '模型调用错误',
  [UnifiedErrorCode.MODEL_TIMEOUT]: '模型调用超时',
  [UnifiedErrorCode.MODEL_UNAVAILABLE]: '模型不可用',
  [UnifiedErrorCode.MODEL_OVERLOADED]: '模型过载',
  [UnifiedErrorCode.CONTEXT_LENGTH_EXCEEDED]: '上下文长度超限',
  [UnifiedErrorCode.CONTENT_FILTER]: '内容过滤触发',
  
  [UnifiedErrorCode.INTERNAL_ERROR]: '内部错误',
  [UnifiedErrorCode.DATABASE_ERROR]: '数据库错误',
  [UnifiedErrorCode.NETWORK_ERROR]: '网络错误',
  [UnifiedErrorCode.UNKNOWN_ERROR]: '未知错误',
};

/**
 * 获取错误码消息
 * @param code 错误码
 * @returns {string} 错误消息
 */
export function getErrorMessage(code: UnifiedErrorCode): string {
  return ErrorCodeMessages[code] || ErrorCodeMessages[UnifiedErrorCode.UNKNOWN_ERROR];
}

/**
 * 判断错误是否可重试
 * @param code 错误码
 * @returns {boolean} 是否可重试
 */
export function isRetryableError(code: UnifiedErrorCode): boolean {
  const retryableCodes = [
    UnifiedErrorCode.RATE_LIMIT_EXCEEDED,
    UnifiedErrorCode.MODEL_TIMEOUT,
    UnifiedErrorCode.MODEL_OVERLOADED,
    UnifiedErrorCode.NETWORK_ERROR,
    UnifiedErrorCode.CIRCUIT_BREAKER_OPEN,
    UnifiedErrorCode.MODEL_CIRCUIT_OPEN,
  ];
  return retryableCodes.includes(code);
}

import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodeToHttpStatus, ErrorCodeMessages } from './error-code';

/**
 * 业务异常接口
 */
export interface BusinessErrorInfo {
  /** 错误码 */
  code: ErrorCode;
  /** 错误消息 */
  message: string;
  /** HTTP状态码 */
  httpStatus: number;
  /** 额外数据 */
  data?: Record<string, unknown>;
  /** 原始错误 */
  cause?: Error;
}

/**
 * 业务异常基类
 * 
 * 所有业务异常都应继承此类，提供统一的错误处理机制
 * 
 * @example
 * ```ts
 * throw new BusinessException(ErrorCode.AGENT_NOT_FOUND, '智能体不存在');
 * throw new AgentNotFoundException('agent-001');
 * ```
 */
export class BusinessException extends HttpException {
  /** 错误码 */
  readonly code: ErrorCode;
  
  /** 额外数据 */
  readonly data?: Record<string, unknown>;
  
  /** 原始错误 */
  readonly originalError?: Error;

  /**
   * 构造函数
   * @param code 错误码
   * @param message 错误消息（可选，默认使用错误码对应的消息）
   * @param data 额外数据
   * @param cause 原始错误
   */
  constructor(
    code: ErrorCode,
    message?: string,
    data?: Record<string, unknown>,
    cause?: Error,
  ) {
    const httpStatus = ErrorCodeToHttpStatus[code] || HttpStatus.INTERNAL_SERVER_ERROR;
    const finalMessage = message || ErrorCodeMessages[code] || '未知错误';
    
    super(
      {
        code,
        message: finalMessage,
        data,
      },
      httpStatus,
      { cause },
    );

    this.code = code;
    this.data = data;
    this.originalError = cause;

    if (cause) {
      this.stack = cause.stack;
    }
  }

  /**
   * 转换为错误信息对象
   */
  toErrorInfo(): BusinessErrorInfo {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.getStatus(),
      data: this.data,
      cause: this.originalError,
    };
  }

  /**
   * 从普通错误创建业务异常
   */
  static fromError(error: Error, code: ErrorCode = ErrorCode.UNKNOWN): BusinessException {
    if (error instanceof BusinessException) {
      return error;
    }
    return new BusinessException(code, error.message, undefined, error);
  }
}

// ==================== 通用异常 ====================

/**
 * 资源不存在异常
 */
export class NotFoundException extends BusinessException {
  constructor(resource: string, identifier?: string | number) {
    super(
      ErrorCode.NOT_FOUND,
      identifier ? `${resource}不存在: ${identifier}` : `${resource}不存在`,
      { resource, identifier },
    );
  }
}

/**
 * 参数无效异常
 */
export class InvalidParamsException extends BusinessException {
  constructor(message: string, data?: Record<string, unknown>) {
    super(ErrorCode.INVALID_PARAMS, message, data);
  }
}

/**
 * 权限不足异常
 */
export class PermissionDeniedException extends BusinessException {
  constructor(message: string = '权限不足') {
    super(ErrorCode.PERMISSION_DENIED, message);
  }
}

/**
 * 操作失败异常
 */
export class OperationFailedException extends BusinessException {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.OPERATION_FAILED, message, undefined, cause);
  }
}

/**
 * 请求超时异常
 */
export class TimeoutException extends BusinessException {
  constructor(operation: string, timeoutMs?: number) {
    super(
      ErrorCode.TIMEOUT,
      timeoutMs ? `${operation}超时 (${timeoutMs}ms)` : `${operation}超时`,
      { operation, timeoutMs },
    );
  }
}

// ==================== 智能体异常 ====================

/**
 * 智能体不存在异常
 */
export class AgentNotFoundException extends BusinessException {
  constructor(identifier: string | number) {
    super(ErrorCode.AGENT_NOT_FOUND, `智能体不存在: ${identifier}`, { identifier });
  }
}

/**
 * 智能体已禁用异常
 */
export class AgentDisabledException extends BusinessException {
  constructor(identifier: string | number) {
    super(ErrorCode.AGENT_DISABLED, `智能体已禁用: ${identifier}`, { identifier });
  }
}

/**
 * 智能体执行失败异常
 */
export class AgentExecutionFailedException extends BusinessException {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.AGENT_EXECUTION_FAILED, message, undefined, cause);
  }
}

// ==================== AI服务异常 ====================

/**
 * AI服务异常
 */
export class AIServiceException extends BusinessException {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.AI_SERVICE_ERROR, message, undefined, cause);
  }
}

/**
 * AI模型不存在异常
 */
export class AIModelNotFoundException extends BusinessException {
  constructor(modelId: string) {
    super(ErrorCode.AI_MODEL_NOT_FOUND, `AI模型不存在: ${modelId}`, { modelId });
  }
}

/**
 * AI提供商错误异常
 */
export class AIProviderException extends BusinessException {
  constructor(provider: string, message: string, cause?: Error) {
    super(ErrorCode.AI_PROVIDER_ERROR, `[${provider}] ${message}`, { provider }, cause);
  }
}

/**
 * AI上下文过长异常
 */
export class AIContextTooLongException extends BusinessException {
  constructor(tokenCount: number, maxTokens: number) {
    super(
      ErrorCode.AI_CONTEXT_TOO_LONG,
      `上下文过长: ${tokenCount} > ${maxTokens}`,
      { tokenCount, maxTokens },
    );
  }
}

// ==================== 模型异常 ====================

/**
 * 模型不存在异常
 */
export class ModelNotFoundException extends BusinessException {
  constructor(identifier: string | number) {
    super(ErrorCode.MODEL_NOT_FOUND, `模型不存在: ${identifier}`, { identifier });
  }
}

/**
 * 模型熔断异常
 */
export class ModelCircuitOpenException extends BusinessException {
  constructor(modelId: string) {
    super(ErrorCode.MODEL_CIRCUIT_OPEN, `模型熔断中: ${modelId}`, { modelId });
  }
}

// ==================== 技能异常 ====================

/**
 * 技能不存在异常
 */
export class SkillNotFoundException extends BusinessException {
  constructor(skillCode: string) {
    super(ErrorCode.SKILL_NOT_FOUND, `技能不存在: ${skillCode}`, { skillCode });
  }
}

/**
 * 技能执行失败异常
 */
export class SkillExecutionException extends BusinessException {
  constructor(skillCode: string, message: string, cause?: Error) {
    super(
      ErrorCode.SKILL_EXECUTION_FAILED,
      `技能执行失败 [${skillCode}]: ${message}`,
      { skillCode },
      cause,
    );
  }
}

// ==================== 知识库异常 ====================

/**
 * 知识库不存在异常
 */
export class KbNotFoundException extends BusinessException {
  constructor(kbCode: string) {
    super(ErrorCode.KB_NOT_FOUND, `知识库不存在: ${kbCode}`, { kbCode });
  }
}

/**
 * 知识库搜索失败异常
 */
export class KbSearchException extends BusinessException {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.KB_SEARCH_FAILED, message, undefined, cause);
  }
}

// ==================== MCP异常 ====================

/**
 * MCP服务器不存在异常
 */
export class McpServerNotFoundException extends BusinessException {
  constructor(serverName: string) {
    super(ErrorCode.MCP_SERVER_NOT_FOUND, `MCP服务器不存在: ${serverName}`, { serverName });
  }
}

/**
 * MCP连接失败异常
 */
export class McpConnectionException extends BusinessException {
  constructor(serverName: string, cause?: Error) {
    super(
      ErrorCode.MCP_CONNECTION_FAILED,
      `MCP连接失败: ${serverName}`,
      { serverName },
      cause,
    );
  }
}

// ==================== 工具异常 ====================

/**
 * 工具不存在异常
 */
export class ToolNotFoundException extends BusinessException {
  constructor(toolName: string) {
    super(ErrorCode.TOOL_NOT_FOUND, `工具不存在: ${toolName}`, { toolName });
  }
}

/**
 * 工具执行失败异常
 */
export class ToolExecutionException extends BusinessException {
  constructor(toolName: string, message: string, cause?: Error) {
    super(
      ErrorCode.TOOL_EXECUTION_FAILED,
      `工具执行失败 [${toolName}]: ${message}`,
      { toolName },
      cause,
    );
  }
}

/**
 * 工具参数无效异常
 */
export class ToolInvalidArgsException extends BusinessException {
  constructor(toolName: string, message: string) {
    super(ErrorCode.TOOL_INVALID_ARGS, `工具参数无效 [${toolName}]: ${message}`, { toolName });
  }
}

// ==================== 文件异常 ====================

/**
 * 文件不存在异常
 */
export class FileNotFoundException extends BusinessException {
  constructor(fileId: string | number) {
    super(ErrorCode.FILE_NOT_FOUND, `文件不存在: ${fileId}`, { fileId });
  }
}

/**
 * 文件过大异常
 */
export class FileTooLargeException extends BusinessException {
  constructor(fileName: string, maxSize: number) {
    super(
      ErrorCode.FILE_TOO_LARGE,
      `文件过大: ${fileName}，最大允许 ${maxSize} 字节`,
      { fileName, maxSize },
    );
  }
}

// ==================== 认证异常 ====================

/**
 * 未授权异常
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = '未授权') {
    super(ErrorCode.AUTH_UNAUTHORIZED, message);
  }
}

/**
 * 令牌过期异常
 */
export class TokenExpiredException extends BusinessException {
  constructor() {
    super(ErrorCode.AUTH_TOKEN_EXPIRED, '令牌已过期');
  }
}

/**
 * 令牌无效异常
 */
export class TokenInvalidException extends BusinessException {
  constructor() {
    super(ErrorCode.AUTH_TOKEN_INVALID, '令牌无效');
  }
}

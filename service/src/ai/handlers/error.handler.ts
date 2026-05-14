import { Injectable, Logger } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { ExecutionParams } from '../interfaces/executor.interface';
import { LogService } from '../infrastructure/log.service';
import { McpService } from '../../mcp/mcp.service';

/**
 * 标准化错误接口
 */
export interface NormalizedError {
  /** 错误消息 */
  message: string;
  /** 错误码 */
  code?: string;
  /** 是否可重试 */
  isRetryable: boolean;
  /** HTTP 状态码 */
  statusCode?: number;
  /** 原始错误 */
  raw?: unknown;
}

/**
 * 错误处理器
 * 统一处理所有模型调用错误
 */
@Injectable()
export class ErrorHandler {
  private readonly logger = new Logger(ErrorHandler.name);

  /**
   * 可重试的错误码
   */
  private readonly retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'rate_limit_exceeded',
    'overloaded',
  ];

  /**
   * 构造函数
   * @param logService 日志服务
   * @param mcpService MCP 服务
   */
  constructor(
    private readonly logService: LogService,
    private readonly mcpService: McpService,
  ) {}

  /**
   * 处理错误
   * @param error 错误对象
   * @param params 执行参数
   */
  async handle(error: unknown, params: ExecutionParams): Promise<void> {
    const normalized = this.normalize(error);
    const { model, context } = params;

    this.logger.error(
      `[${context.requestId}] 模型调用错误: ${normalized.message}`,
      normalized.raw
    );

    await Promise.all([
      this.logService.logFailure(params, normalized),
      this.mcpService.reportError(model.id),
    ]);
  }

  /**
   * 标准化错误
   * @param error 原始错误
   * @returns 标准化错误
   */
  normalize(error: unknown): NormalizedError {
    if (axios.isAxiosError(error)) {
      return this.normalizeAxiosError(error);
    }

    if (error instanceof HttpException) {
      return this.normalizeHttpException(error);
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        isRetryable: this.retryableCodes.some(code =>
          error.message.toLowerCase().includes(code.toLowerCase())
        ),
        raw: error,
      };
    }

    return {
      message: '未知错误',
      isRetryable: false,
      raw: error,
    };
  }

  /**
   * 标准化 Axios 错误
   * @param error Axios 错误
   * @returns 标准化错误
   */
  private normalizeAxiosError(error: AxiosError): NormalizedError {
    const respData = error.response?.data as any;
    let message = '请求失败';

    if (respData?.error?.message) {
      message = respData.error.message;
    } else if (respData?.message) {
      message = respData.message;
    } else if (error.message) {
      message = error.message;
    }

    const code = respData?.error?.code || error.code;

    return {
      message,
      code,
      statusCode: error.response?.status,
      isRetryable: this.isRetryableError(error),
      raw: error,
    };
  }

  /**
   * 标准化 HTTP 异常
   * @param error HTTP 异常
   * @returns 标准化错误
   */
  private normalizeHttpException(error: HttpException): NormalizedError {
    return {
      message: error.message,
      statusCode: error.getStatus(),
      isRetryable: false,
      raw: error,
    };
  }

  /**
   * 判断是否可重试
   * @param error Axios 错误
   * @returns 是否可重试
   */
  private isRetryableError(error: AxiosError): boolean {
    const status = error.response?.status;
    const code = error.code;

    if (status === 429 || status === 503 || status === 502) {
      return true;
    }

    return this.retryableCodes.includes(code || '');
  }

  /**
   * 转换为 HTTP 异常
   * @param normalized 标准化错误
   * @returns HTTP 异常
   */
  toHttpException(normalized: NormalizedError): HttpException {
    return new HttpException(
      `模型调用失败: ${normalized.message}`,
      normalized.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

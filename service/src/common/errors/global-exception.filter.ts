import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';
import { fail } from '../response/api.response';
import { BusinessException, BusinessErrorInfo } from './business.exception';
import { ErrorCode, ErrorCodeToHttpStatus, ErrorCodeMessages } from './error-code';

/**
 * 错误响应结构
 */
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
  path: string;
}

/**
 * 全局异常过滤器
 * 
 * 统一处理所有异常并返回标准格式：
 * - BusinessException: 业务异常
 * - HttpException: HTTP异常
 * - Prisma错误: 数据库错误
 * - Error: 其他错误
 * 
 * @example
 * ```ts
 * // 在 main.ts 中注册
 * app.useGlobalFilters(new GlobalExceptionFilter());
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * 捕获异常并处理
   * @param exception 异常对象
   * @param host 参数宿主
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);
    
    this.logError(exception, request, errorResponse);

    const httpStatus = ErrorCodeToHttpStatus[errorResponse.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    
    response.status(httpStatus).json(
      fail(errorResponse.code, errorResponse.message, errorResponse.data),
    );
  }

  /**
   * 构建错误响应
   */
  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const baseResponse: ErrorResponse = {
      code: ErrorCode.UNKNOWN,
      message: ErrorCodeMessages[ErrorCode.UNKNOWN],
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof BusinessException) {
      return this.handleBusinessException(exception, baseResponse);
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, baseResponse);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, baseResponse);
    }

    if (exception instanceof Error) {
      return this.handleGenericError(exception, baseResponse);
    }

    return baseResponse;
  }

  /**
   * 处理业务异常
   */
  private handleBusinessException(
    exception: BusinessException,
    baseResponse: ErrorResponse,
  ): ErrorResponse {
    const info = exception.toErrorInfo();
    
    return {
      ...baseResponse,
      code: info.code,
      message: info.message,
      data: info.data,
    };
  }

  /**
   * 处理HTTP异常
   */
  private handleHttpException(
    exception: HttpException,
    baseResponse: ErrorResponse,
  ): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let data: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const res = exceptionResponse as Record<string, unknown>;
      message = (res.message as string) || exception.message;
      
      if (res.errors) {
        data = { errors: res.errors };
      }
    }

    const errorCode = this.httpStatusToErrorCode(status);

    return {
      ...baseResponse,
      code: errorCode,
      message,
      data,
    };
  }

  /**
   * 处理Prisma数据库错误
   */
  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    baseResponse: ErrorResponse,
  ): ErrorResponse {
    let code = ErrorCode.DB_QUERY_FAILED;
    let message = '数据库查询失败';

    switch (exception.code) {
      case 'P2002':
        code = ErrorCode.ALREADY_EXISTS;
        message = '资源已存在';
        break;
      case 'P2025':
        code = ErrorCode.NOT_FOUND;
        message = '资源不存在';
        break;
      case 'P2003':
        code = ErrorCode.INVALID_PARAMS;
        message = '关联资源不存在';
        break;
      case 'P2014':
        code = ErrorCode.INVALID_PARAMS;
        message = '关联关系无效';
        break;
      case 'P2001':
        code = ErrorCode.DB_CONNECTION_FAILED;
        message = '数据库连接失败';
        break;
    }

    return {
      ...baseResponse,
      code,
      message,
      data: {
        prismaCode: exception.code,
        meta: exception.meta,
      },
    };
  }

  /**
   * 处理通用错误
   */
  private handleGenericError(
    exception: Error,
    baseResponse: ErrorResponse,
  ): ErrorResponse {
    return {
      ...baseResponse,
      code: ErrorCode.UNKNOWN,
      message: exception.message || ErrorCodeMessages[ErrorCode.UNKNOWN],
    };
  }

  /**
   * HTTP状态码转错误码
   */
  private httpStatusToErrorCode(status: number): ErrorCode {
    const mapping: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.INVALID_PARAMS,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.PERMISSION_DENIED,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.ALREADY_EXISTS,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.UNKNOWN,
      [HttpStatus.BAD_GATEWAY]: ErrorCode.AI_PROVIDER_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
      [HttpStatus.GATEWAY_TIMEOUT]: ErrorCode.TIMEOUT,
    };

    return mapping[status] || ErrorCode.UNKNOWN;
  }

  /**
   * 记录错误日志
   */
  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse,
  ): void {
    const { method, url, body, query, params } = request;
    
    const logContext = {
      method,
      url,
      code: errorResponse.code,
      message: errorResponse.message,
      timestamp: errorResponse.timestamp,
    };

    if (errorResponse.code >= 500) {
      this.logger.error(
        `[${method}] ${url} - ${errorResponse.code}: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else if (errorResponse.code >= 400) {
      this.logger.warn(
        `[${method}] ${url} - ${errorResponse.code}: ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    } else {
      this.logger.log(
        `[${method}] ${url} - ${errorResponse.code}: ${errorResponse.message}`,
      );
    }
  }
}

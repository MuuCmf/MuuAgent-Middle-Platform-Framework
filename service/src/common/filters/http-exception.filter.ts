import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { fail } from '../response/api.response';

/**
 * 全局异常过滤器
 * 统一处理所有异常并返回标准格式
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  /**
   * 捕获异常并处理
   * @param exception 异常对象
   * @param host 参数宿主
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      console.error('未捕获的异常:', exception);
    }

    response.status(status).json(fail(status, message));
  }
}

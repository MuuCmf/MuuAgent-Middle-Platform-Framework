import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimitService, RateLimitLevel } from './rate-limit.service';

/**
 * 限流守卫
 * 在请求到达控制器前进行限流检查
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  /**
   * 构造函数
   * @param rateLimitService 限流服务
   */
  constructor(private rateLimitService: RateLimitService) {}

  /**
   * 检查请求是否允许通过
   * @param context 执行上下文
   * @returns {Promise<boolean>} 是否允许通过
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 获取客户端IP
    const clientIp = this.getClientIp(request);

    // 获取请求路径
    const path = request.route?.path || request.path;

    // 获取应用标识（从header或query中获取）
    const appCode = request.headers['x-app-code'] || request.query.appCode;

    try {
      // 1. 全局限流检查
      const globalResult = await this.rateLimitService.checkRateLimit(
        RateLimitLevel.GLOBAL,
        'global',
        clientIp,
      );

      if (!globalResult.allowed) {
        this.setRateLimitHeaders(response, globalResult);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: globalResult.reason || '请求过于频繁，请稍后再试',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. 应用级限流检查
      if (appCode) {
        const appResult = await this.rateLimitService.checkRateLimit(
          RateLimitLevel.APP,
          appCode,
          clientIp,
        );

        if (!appResult.allowed) {
          this.setRateLimitHeaders(response, appResult);
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: appResult.reason || '应用请求限额已满',
              error: 'Too Many Requests',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // 3. 接口级限流检查
      const interfaceResult = await this.rateLimitService.checkRateLimit(
        RateLimitLevel.INTERFACE,
        path,
        clientIp,
      );

      if (!interfaceResult.allowed) {
        this.setRateLimitHeaders(response, interfaceResult);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: interfaceResult.reason || '接口请求过于频繁',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 设置限流信息到请求对象
      request.rateLimit = {
        global: globalResult,
        app: appCode ? await this.rateLimitService.checkRateLimit(RateLimitLevel.APP, appCode, clientIp) : null,
        interface: interfaceResult,
      };

      // 设置响应头
      this.setRateLimitHeaders(response, interfaceResult);

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // 其他错误允许通过，避免限流服务异常影响正常请求
      console.error('Rate limit check failed:', error);
      return true;
    }
  }

  /**
   * 获取客户端IP
   * @param request 请求对象
   * @returns {string} 客户端IP
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 设置限流响应头
   * @param response 响应对象
   * @param result 限流结果
   */
  private setRateLimitHeaders(response: any, result: any): void {
    if (result.currentQps !== undefined) {
      response.setHeader('X-RateLimit-Limit', result.currentQps);
    }
    if (result.remainingQuota !== undefined) {
      response.setHeader('X-RateLimit-Remaining', result.remainingQuota);
    }
    if (result.retryAfter) {
      response.setHeader('Retry-After', result.retryAfter);
    }
  }
}

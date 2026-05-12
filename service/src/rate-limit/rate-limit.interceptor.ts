import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RateLimitService } from './rate-limit.service';
import { AppUsageService } from '../common/services/app-usage.service';

/**
 * 限流拦截器
 * 1. 请求完成后释放并发计数，确保并发计数器不会只增不减
 * 2. 统一记录应用调用次数（appCode 由 TenantGuard 从 x-api-key 解析）
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private rateLimitService: RateLimitService,
    private appUsageService: AppUsageService,
  ) {}

  /**
   * 拦截器
   * @param context 执行上下文
   * @param next 下一个处理器
   * @returns {Observable<any>} 处理结果
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const ruleIds: string[] = request.rateLimitRuleIds || [];
    const appCode: string | undefined = request.appCode;

    return next.handle().pipe(
      tap({
        complete: () => {
          this.releaseAll(ruleIds);
          this.recordUsage(appCode);
        },
        error: () => {
          this.releaseAll(ruleIds);
        },
      }),
    );
  }

  /**
   * 释放所有规则的并发计数
   * @param ruleIds 规则ID列表
   */
  private releaseAll(ruleIds: string[]) {
    for (const ruleId of ruleIds) {
      this.rateLimitService.releaseConcurrent(ruleId).catch(() => {});
    }
  }

  /**
   * 记录应用调用次数
   * @param appCode 应用标识
   */
  private recordUsage(appCode: string | undefined) {
    if (appCode) {
      this.appUsageService.incrementCallCount(appCode).catch(() => {});
    }
  }
}

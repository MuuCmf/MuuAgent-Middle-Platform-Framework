import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, finalize } from 'rxjs';
import { RateLimitService } from './rate-limit.service';
import { AppUsageService } from '../common/services/app-usage.service';

/**
 * 限流拦截器
 * 1. 请求完成后释放并发计数，确保并发计数器不会只增不减
 * 2. 统一记录应用调用次数（appCode 由 TenantGuard 从 x-api-key 解析）
 *
 * 注意：SSE 流式请求使用 finalize 替代 tap({ complete }) 确保流结束时释放并发计数
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
    const response = context.switchToHttp().getResponse();
    const ruleIds: string[] = request.rateLimitRuleIds || [];
    const appCode: string | undefined = request.appCode;

    // 为 SSE 流式响应添加连接关闭监听器
    if (response && response.on) {
      response.on('close', () => {
        this.releaseAll(ruleIds);
      });
    }

    return next.handle().pipe(
      finalize(() => {
        this.releaseAll(ruleIds);
        this.recordUsage(appCode);
      }),
    );
  }

  /**
   * 释放所有规则的并发计数（同步执行，确保计数正确释放）
   * @param ruleIds 规则ID列表
   */
  private releaseAll(ruleIds: string[]) {
    // 使用 Promise.all 确保所有释放操作都完成
    Promise.all(
      ruleIds.map((ruleId) => this.rateLimitService.releaseConcurrent(ruleId)),
    ).catch((error) => {
      console.error('Failed to release concurrent counters:', error);
    });
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

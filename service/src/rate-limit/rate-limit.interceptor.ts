import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RateLimitService } from './rate-limit.service';

/**
 * 限流拦截器
 * 在请求完成后释放并发计数，确保并发计数器不会只增不减
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private rateLimitService: RateLimitService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const ruleIds: string[] = request.rateLimitRuleIds || [];

    return next.handle().pipe(
      tap({
        complete: () => this.releaseAll(ruleIds),
        error: () => this.releaseAll(ruleIds),
      }),
    );
  }

  private releaseAll(ruleIds: string[]) {
    for (const ruleId of ruleIds) {
      this.rateLimitService.releaseConcurrent(ruleId).catch(() => {});
    }
  }
}

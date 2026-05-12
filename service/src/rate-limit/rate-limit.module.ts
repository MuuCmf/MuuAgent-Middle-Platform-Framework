import { Module, Global } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitController } from './rate-limit.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 限流模块
 * 提供全局、应用级、接口级、模型级限流功能
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RateLimitController],
  providers: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
  exports: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
})
export class RateLimitModule {}

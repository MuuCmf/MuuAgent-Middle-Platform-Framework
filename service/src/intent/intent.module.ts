import { Module } from '@nestjs/common';
import { IntentClassifierService } from './intent.service';
import { IntentKeywordService } from './keyword/keyword.service';
import { IntentRoutingLogService } from './routing-log/routing-log.service';
import { IntentKeywordController } from './keyword/keyword.controller';
import { IntentDashboardController } from './dashboard/dashboard.controller';
import { IntentCacheController } from './cache/cache.controller';
import { IntentRoutingLogController } from './routing-log/routing-log.controller';
import { ModelModule } from '../model/model.module';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 意图统一模块
 * 整合意图分类、关键词管理、缓存管理、监控看板、路由日志
 * AI分类使用独立HTTP调用，不依赖AiModule，避免循环依赖
 */
@Module({
  imports: [ModelModule, PrismaModule],
  controllers: [
    IntentKeywordController,
    IntentDashboardController,
    IntentCacheController,
    IntentRoutingLogController,
  ],
  providers: [
    IntentClassifierService,
    IntentKeywordService,
    IntentRoutingLogService,
  ],
  exports: [
    IntentClassifierService,
    IntentRoutingLogService,
  ],
})
export class IntentModule {}
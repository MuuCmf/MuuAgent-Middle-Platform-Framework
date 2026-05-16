import { Module } from '@nestjs/common';
import { IntentRoutingLogController } from './intent-routing-log.controller';
import { IntentRoutingLogService } from './intent-routing-log.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 意图路由日志模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [IntentRoutingLogController],
  providers: [IntentRoutingLogService],
  exports: [IntentRoutingLogService],
})
export class IntentRoutingLogModule {}
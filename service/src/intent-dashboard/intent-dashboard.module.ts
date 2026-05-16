import { Module } from '@nestjs/common';
import { IntentDashboardController } from './intent-dashboard.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 意图监控看板模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [IntentDashboardController],
})
export class IntentDashboardModule {}
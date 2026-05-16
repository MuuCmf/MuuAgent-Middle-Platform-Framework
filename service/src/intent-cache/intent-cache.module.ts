import { Module } from '@nestjs/common';
import { IntentCacheController } from './intent-cache.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 意图缓存管理模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [IntentCacheController],
})
export class IntentCacheModule {}
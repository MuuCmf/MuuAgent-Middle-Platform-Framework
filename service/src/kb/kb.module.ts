import { Module } from '@nestjs/common';
import { KbController, ClientKbController } from './kb.controller';
import { KbService } from './kb.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { CacheService } from '../cache/cache.service';

/**
 * 知识库管理模块
 */
@Module({
  imports: [PrismaModule, RetrievalModule],
  controllers: [KbController, ClientKbController],
  providers: [KbService, CacheService],
  exports: [KbService],
})
export class KbModule {}

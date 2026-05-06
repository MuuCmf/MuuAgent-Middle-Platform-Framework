import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { AiModule } from '../ai/ai.module';
import { CacheModule } from '../cache/cache.module';

/**
 * 检索和RAG问答模块
 */
@Module({
  imports: [PrismaModule, VectorModule, AiModule, CacheModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}

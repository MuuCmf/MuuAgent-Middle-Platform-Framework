import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { AiModule } from '../ai/ai.module';
import { CacheModule } from '../cache/cache.module';
import { BM25Module } from './bm25.module';
import { PromptTemplateModule } from '../prompt-template/prompt-template.module';
import { ConversationModule } from '../conversation/conversation.module';
import { ModelRoutingModule } from "../model-routing/model-routing.module";
import { ModelModule } from '../model/model.module';
import { ModelTemplateModule } from '../model-template/model-template.module';

/**
 * 检索和RAG问答模块
 */
@Module({
  imports: [PrismaModule, VectorModule, AiModule, CacheModule, BM25Module, PromptTemplateModule, ConversationModule, ModelRoutingModule, ModelModule, ModelTemplateModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}

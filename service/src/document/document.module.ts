import { Module } from '@nestjs/common';
import { DocumentAdminController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { TaskModule } from '../task/task.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { CacheService } from '../cache/cache.service';

/**
 * 文档管理模块
 */
@Module({
  imports: [PrismaModule, VectorModule, TaskModule, RetrievalModule],
  controllers: [DocumentAdminController],
  providers: [DocumentService, CacheService],
  exports: [DocumentService],
})
export class DocumentModule {}

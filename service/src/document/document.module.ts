import { Module } from '@nestjs/common';
import { DocumentAdminController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { TaskModule } from '../task/task.module';

/**
 * 文档管理模块
 */
@Module({
  imports: [PrismaModule, VectorModule, TaskModule],
  controllers: [DocumentAdminController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}

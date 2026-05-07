import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { DocumentProcessor } from './processors/document.processor';
import { PrismaModule } from '../common/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';
import { AiModule } from '../ai/ai.module';

/**
 * 任务队列模块
 * 提供异步任务处理能力，用于处理耗时操作
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'document',
    }),
    PrismaModule,
    VectorModule,
    AiModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, DocumentProcessor],
  exports: [TaskService],
})
export class TaskModule {}
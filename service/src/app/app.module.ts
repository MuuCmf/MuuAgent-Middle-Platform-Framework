import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 应用管理模块
 * 
 * 提供应用的CRUD功能，包括：
 * - 应用创建、更新、删除
 * - 应用列表查询
 * - 应用详情查询
 * - 应用密钥重置
 * - 应用使用统计
 */
@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}

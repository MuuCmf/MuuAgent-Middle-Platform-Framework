import { Module } from '@nestjs/common';
import { KbController, ClientKbController } from './kb.controller';
import { KbService } from './kb.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * 知识库管理模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [KbController, ClientKbController],
  providers: [KbService],
  exports: [KbService],
})
export class KbModule {}

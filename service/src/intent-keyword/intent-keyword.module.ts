import { Module } from '@nestjs/common';
import { IntentKeywordController } from './intent-keyword.controller';
import { IntentKeywordService } from './intent-keyword.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { IntentModule } from '../intent/intent.module';

/**
 * 意图关键词管理模块
 */
@Module({
  imports: [PrismaModule, IntentModule],
  controllers: [IntentKeywordController],
  providers: [IntentKeywordService],
  exports: [IntentKeywordService],
})
export class IntentKeywordModule {}
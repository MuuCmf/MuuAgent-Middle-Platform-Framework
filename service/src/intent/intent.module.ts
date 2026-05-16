import { Module } from '@nestjs/common';
import { IntentClassifierService } from './intent.service';
import { ModelModule } from '../model/model.module';

/**
 * 意图分类模块
 * 提供对话意图识别能力，支持关键词匹配和AI分类
 * AI分类使用独立HTTP调用，不依赖AiModule，避免循环依赖
 */
@Module({
  imports: [ModelModule],
  providers: [IntentClassifierService],
  exports: [IntentClassifierService],
})
export class IntentModule {}
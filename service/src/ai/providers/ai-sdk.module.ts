import { Module, Global } from '@nestjs/common';
import { AiSdkProvider } from './ai-sdk.provider';
import { ModelModule } from '../../model/model.module';

/**
 * AI SDK 模块
 * 提供 Vercel AI SDK 集成
 */
@Global()
@Module({
  imports: [ModelModule],
  providers: [AiSdkProvider],
  exports: [AiSdkProvider],
})
export class AiSdkModule {}
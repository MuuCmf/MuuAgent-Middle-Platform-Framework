import { Module, Global } from '@nestjs/common';
import { AiSdkProvider } from './ai-sdk.provider';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { McpModule } from '../../mcp/mcp.module';

/**
 * AI SDK 模块
 * 提供 Vercel AI SDK 集成
 */
@Global()
@Module({
  imports: [PrismaModule, McpModule],
  providers: [AiSdkProvider],
  exports: [AiSdkProvider],
})
export class AiSdkModule {}
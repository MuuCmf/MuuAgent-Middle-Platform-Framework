import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { McpModule } from '../mcp/mcp.module';
import { ModelModule } from '../model/model.module';

/**
 * AI调用模块
 */
@Module({
  imports: [McpModule, ModelModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

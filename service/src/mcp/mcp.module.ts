import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ModelModule } from '../model/model.module';
import { IntentModule } from '../intent/intent.module';

/**
 * MCP调度模块
 */
@Module({
  imports: [ModelModule, IntentModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}

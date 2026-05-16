import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ModelModule } from '../model/model.module';
import { IntentModule } from '../intent/intent.module';
import { IntentRoutingLogModule } from '../intent-routing-log/intent-routing-log.module';

/**
 * MCP调度模块
 */
@Module({
  imports: [ModelModule, IntentModule, IntentRoutingLogModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}

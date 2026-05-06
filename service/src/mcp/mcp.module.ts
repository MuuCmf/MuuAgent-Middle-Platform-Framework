import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ModelModule } from '../model/model.module';

/**
 * MCP调度模块
 */
@Module({
  imports: [ModelModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}

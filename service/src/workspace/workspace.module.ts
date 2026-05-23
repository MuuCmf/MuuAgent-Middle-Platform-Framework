import { Module } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';
import { WorkspaceResultController } from './workspace-result.controller';

/**
 * 工作目录模块
 *
 * WorkspaceToolHandler 使用 @ClientToolProvider 装饰器，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry，
 * 无需手动在 onModuleInit 中调用 clientToolRegistry.register()
 */
@Module({
  controllers: [WorkspaceResultController],
  providers: [WorkspaceToolHandler],
  exports: [WorkspaceToolHandler],
})
export class WorkspaceModule {}

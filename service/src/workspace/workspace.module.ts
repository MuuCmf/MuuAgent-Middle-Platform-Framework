import { Module } from '@nestjs/common';
import { WorkspaceToolHandler } from './workspace-tool.handler';

/**
 * 工作目录模块
 *
 * WorkspaceToolHandler 使用 @ClientToolProvider 装饰器，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry，
 * 无需手动在 onModuleInit 中调用 clientToolRegistry.register()
 *
 * 结果回传已统一到 ClientToolResultController，
 * 无需单独的 WorkspaceResultController
 */
@Module({
  providers: [WorkspaceToolHandler],
  exports: [WorkspaceToolHandler],
})
export class WorkspaceModule {}

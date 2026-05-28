import { Module } from '@nestjs/common';
import { BrowserToolHandler } from './browser-tool.handler';

/**
 * 浏览器自动化模块
 *
 * BrowserToolHandler 使用 @ClientToolProvider 装饰器，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry，
 * 无需手动在 onModuleInit 中调用 clientToolRegistry.register()
 *
 * 结果回传已统一到 ClientToolResultController，
 * 无需单独的 BrowserResultController
 *
 * 与 WorkspaceModule 架构一致，遵循 ClientTool 架构
 */
@Module({
  providers: [BrowserToolHandler],
  exports: [BrowserToolHandler],
})
export class BrowserModule {}
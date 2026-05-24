import { Module } from '@nestjs/common';
import { DesktopToolHandler } from './desktop-tool.handler';

/**
 * 桌面自动化工具模块
 *
 * DesktopToolHandler 使用 @ClientToolProvider 装饰器，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry，
 * 无需手动在 onModuleInit 中调用 clientToolRegistry.register()
 *
 * 结果回传已统一到 ClientToolResultController，
 * 无需单独的 DesktopResultController
 */
@Module({
  providers: [DesktopToolHandler],
  exports: [DesktopToolHandler],
})
export class DesktopModule {}
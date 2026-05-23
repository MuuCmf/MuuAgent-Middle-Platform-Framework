import { Module } from '@nestjs/common';
import { SystemControlHandler } from './system-control.handler';
import { SystemControlResultController } from './system-control-result.controller';

/**
 * 系统控制模块
 *
 * SystemControlHandler 使用 @ClientToolProvider 装饰器，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry，
 * 无需手动在 onModuleInit 中调用 clientToolRegistry.register()
 */
@Module({
  controllers: [SystemControlResultController],
  providers: [SystemControlHandler],
  exports: [SystemControlHandler],
})
export class SystemControlModule {}

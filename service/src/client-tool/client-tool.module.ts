import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolDiscoveryService } from './client-tool-discovery.service';

/**
 * 客户端工具全局模块
 * 提供 ClientToolRegistry 注册表和 ClientToolDiscoveryService 自动发现服务
 *
 * 即插即用：新增客户端工具只需在模块的 providers 中添加带 @ClientToolProvider 的 Handler 类，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [ClientToolRegistry, ClientToolDiscoveryService],
  exports: [ClientToolRegistry, ClientToolDiscoveryService],
})
export class ClientToolModule {}

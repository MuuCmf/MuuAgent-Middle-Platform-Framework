import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolDiscoveryService } from './client-tool-discovery.service';
import { ClientToolPolicyService } from './client-tool-policy.service';
import { ClientToolPolicyController } from './client-tool-policy.controller';
import { ClientToolResultController } from './client-tool-result.controller';

/**
 * 客户端工具全局模块
 * 提供 ClientToolRegistry 注册表、ClientToolDiscoveryService 自动发现服务
 * 和 ClientToolPolicyService 权限配置服务
 *
 * 即插即用：新增客户端工具只需在模块的 providers 中添加带 @ClientToolProvider 的 Handler 类，
 * ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry
 *
 * 统一结果回传：所有客户端工具的执行结果通过 ClientToolResultController 统一接收，
 * 新增工具模块无需额外创建结果回传 Controller
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [ClientToolRegistry, ClientToolDiscoveryService, ClientToolPolicyService],
  controllers: [ClientToolPolicyController, ClientToolResultController],
  exports: [ClientToolRegistry, ClientToolDiscoveryService, ClientToolPolicyService],
})
export class ClientToolModule {}

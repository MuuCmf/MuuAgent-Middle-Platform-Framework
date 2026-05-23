import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolDiscoveryService } from './client-tool-discovery.service';
import { ClientToolPolicyService } from './client-tool-policy.service';
import { ClientToolPolicyController } from './client-tool-policy.controller';
import { ClientToolResultController } from './client-tool-result.controller';
import { DynamicClientToolModule } from './dynamic/dynamic-client-tool.module';

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
 *
 * 动态扩展：DynamicClientToolModule 提供用户自扩展客户端工具能力，
 * 用户通过 API 注册工具后自动生效，无需服务端代码变更
 */
@Global()
@Module({
  imports: [DiscoveryModule, DynamicClientToolModule],
  providers: [ClientToolRegistry, ClientToolDiscoveryService, ClientToolPolicyService],
  controllers: [ClientToolPolicyController, ClientToolResultController],
  exports: [ClientToolRegistry, ClientToolDiscoveryService, ClientToolPolicyService],
})
export class ClientToolModule {}

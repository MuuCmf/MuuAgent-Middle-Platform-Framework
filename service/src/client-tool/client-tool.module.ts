import { Global, Module } from '@nestjs/common';
import { ClientToolRegistry } from './client-tool-registry';

/**
 * 客户端工具全局模块
 * 提供 ClientToolRegistry 注册表，供所有客户端工具模块注册和查询
 */
@Global()
@Module({
  providers: [ClientToolRegistry],
  exports: [ClientToolRegistry],
})
export class ClientToolModule {}

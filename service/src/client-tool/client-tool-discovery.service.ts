import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolEntry } from './client-tool-entry';
import { CLIENT_TOOL_PROVIDER } from '../agent/tools/constants/tool.constants';
import { getClientToolProviderMetadata, IClientToolProvider } from './client-tool-provider.decorator';

/**
 * 客户端工具发现统计
 */
export interface ClientToolDiscoveryStats {
  /** 已注册提供者数量 */
  registered: number;
  /** 提供者名称列表 */
  providerNames: string[];
}

/**
 * 客户端工具自动发现服务
 *
 * 通过 NestJS DiscoveryService 自动扫描并注册带有 @ClientToolProvider 装饰器的提供者类。
 * 新增客户端工具模块只需在 providers 中添加带 @ClientToolProvider 的 Handler 类，
 * 本服务会自动发现并注册到 ClientToolRegistry。
 */
@Injectable()
export class ClientToolDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ClientToolDiscoveryService.name);
  private stats: ClientToolDiscoveryStats = {
    registered: 0,
    providerNames: [],
  };

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly clientToolRegistry: ClientToolRegistry,
  ) {}

  /**
   * 模块初始化时自动发现并注册客户端工具提供者
   */
  onModuleInit(): void {
    this.discoverAndRegister();
  }

  /**
   * 获取发现统计信息
   * @returns 统计数据
   */
  getStats(): Readonly<ClientToolDiscoveryStats> {
    return { ...this.stats };
  }

  /**
   * 发现并注册所有客户端工具提供者
   */
  private discoverAndRegister(): void {
    const providers = this.discovery.getProviders();
    const providerNames: string[] = [];

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const metadata = getClientToolProviderMetadata(instance.constructor);
      if (!metadata) continue;

      if (!this.isValidProvider(instance)) {
        this.logger.warn(`客户端工具提供者 [${metadata.name}] 无效，未实现 IClientToolProvider 接口`);
        continue;
      }

      const entry: ClientToolEntry = (instance as IClientToolProvider).getClientToolEntry();
      this.clientToolRegistry.register(entry);
      providerNames.push(metadata.name);

      this.logger.debug(`客户端工具提供者 [${metadata.name}] 已自动注册`);
    }

    this.stats.registered = providerNames.length;
    this.stats.providerNames = providerNames;

    this.logger.log(
      `客户端工具发现完成: 注册 ${this.stats.registered} 个 [${providerNames.join(', ')}]`,
    );
  }

  /**
   * 验证提供者是否有效
   * @param instance 提供者实例
   * @returns 是否有效
   */
  private isValidProvider(instance: any): instance is IClientToolProvider {
    return typeof instance.getClientToolEntry === 'function';
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TOOL_DISPATCHER } from '../constants/tool.constants';
import { DispatcherMetadata, getDispatcherMetadata } from '../decorators/tool.decorator';
import { IToolDispatcher } from '../dispatchers/tool-dispatchers';

/**
 * 分发器收集统计
 */
export interface DispatcherCollectionStats {
  /** 已收集分发器数量 */
  collected: number;
  /** 分发器名称列表 */
  dispatcherNames: string[];
}

/**
 * 分发器自动收集服务
 *
 * 通过 NestJS DiscoveryService 自动扫描并收集带有 @ToolDispatcher 装饰器的分发器类。
 * 收集后按 order 排序，供 ToolExecutor 使用。
 *
 * 新增分发器只需：
 * 1. 创建分发器类并使用 @ToolDispatcher 装饰器
 * 2. 将分发器类添加到 ToolModule 的 providers 中
 * 3. 本服务会自动发现并收集
 */
@Injectable()
export class DispatcherCollectorService implements OnModuleInit {
  private readonly logger = new Logger(DispatcherCollectorService.name);
  private stats: DispatcherCollectionStats = {
    collected: 0,
    dispatcherNames: [],
  };
  private dispatchers: IToolDispatcher[] = [];

  constructor(private readonly discovery: DiscoveryService) {}

  /**
   * 模块初始化时自动收集分发器
   */
  onModuleInit(): void {
    this.collectAndSort();
  }

  /**
   * 获取收集统计信息
   * @returns 统计数据
   */
  getStats(): Readonly<DispatcherCollectionStats> {
    return { ...this.stats };
  }

  /**
   * 获取排序后的分发器列表
   * @returns 分发器列表
   */
  getDispatchers(): IToolDispatcher[] {
    return [...this.dispatchers];
  }

  /**
   * 发现并收集所有分发器，按 order 排序
   */
  private collectAndSort(): void {
    const providers = this.discovery.getProviders();
    const discovered: Array<{ dispatcher: IToolDispatcher; metadata: DispatcherMetadata }> = [];

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const metadata = this.getDispatcherMetadata(instance);
      if (!metadata) continue;

      discovered.push({
        dispatcher: instance as IToolDispatcher,
        metadata,
      });

      this.logger.debug(`分发器 [${metadata.name}] 已发现 (order: ${metadata.order ?? '默认'})`);
    }

    discovered.sort((a, b) => {
      const orderA = a.metadata.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.metadata.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    this.dispatchers = discovered.map(d => d.dispatcher);
    this.stats.collected = this.dispatchers.length;
    this.stats.dispatcherNames = discovered.map(d => d.metadata.name);

    this.logger.log(
      `分发器收集完成: ${this.stats.collected} 个 [${this.stats.dispatcherNames.join(', ')}]`,
    );
  }

  /**
   * 获取分发器元数据
   * @param instance 分发器实例
   * @returns 分发器元数据或 undefined
   */
  private getDispatcherMetadata(instance: any): DispatcherMetadata | undefined {
    return getDispatcherMetadata(instance.constructor);
  }
}

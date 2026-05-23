import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ToolRegistry } from '../tool-registry';
import { IAgentTool } from '../abstract/tool.interface';
import { AGENT_TOOL, TOOL_CONFIG_PREFIX } from '../constants/tool.constants';
import { ToolMetadata } from '../decorators/tool.decorator';

/**
 * 工具发现统计
 */
export interface ToolDiscoveryStats {
  /** 已注册工具数量 */
  registered: number;
  /** 已禁用工具数量 */
  disabled: number;
  /** 无效工具数量 */
  invalid: number;
  /** 已注册工具名称列表 */
  registeredNames: string[];
}

/**
 * 工具自动发现服务
 *
 * 通过 NestJS DiscoveryService 自动扫描并注册带有 @AgentTool 装饰器的工具类。
 * 支持通过配置文件控制工具的启用/禁用。
 *
 * 即插即用：新增工具只需在 ToolModule 的 providers 中添加工具类，
 * 本服务会自动发现并注册到 ToolRegistry，无需其他手动配置。
 *
 * @example
 * ```typescript
 * // 步骤1：创建工具类
 * @AgentTool({ name: 'my_tool', enabled: true, category: 'builtin' })
 * export class MyTool extends BaseTool { ... }
 *
 * // 步骤2：在 ToolModule 的 providers 中添加
 * providers: [
 *   ...BUILTIN_TOOL_PROVIDERS,
 *   MyTool,
 * ]
 * // 完成！ToolDiscoveryService 会自动发现并注册
 * ```
 */
@Injectable()
export class ToolDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ToolDiscoveryService.name);
  private stats: ToolDiscoveryStats = {
    registered: 0,
    disabled: 0,
    invalid: 0,
    registeredNames: [],
  };

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly registry: ToolRegistry,
    private readonly config: ConfigService,
  ) {}

  /**
   * 模块初始化时自动发现并注册工具
   */
  onModuleInit(): void {
    this.discoverAndRegister();
  }

  /**
   * 获取发现统计信息
   * @returns 统计数据
   */
  getStats(): Readonly<ToolDiscoveryStats> {
    return { ...this.stats };
  }

  /**
   * 发现并注册所有工具
   */
  private discoverAndRegister(): void {
    const providers = this.discovery.getProviders();
    const registeredNames: string[] = [];

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const metadata = this.getToolMetadata(instance);
      if (!metadata) continue;

      if (!this.isToolEnabled(metadata)) {
        this.logger.log(`工具 [${metadata.name}] 已禁用，跳过注册`);
        this.stats.disabled++;
        continue;
      }

      if (!this.isValidTool(instance)) {
        this.logger.warn(`工具 [${metadata.name}] 无效，缺少必要属性`);
        this.stats.invalid++;
        continue;
      }

      this.registry.register(instance as IAgentTool);
      registeredNames.push(metadata.name);
      this.logger.debug(`工具 [${metadata.name}] 已自动注册`);
    }

    this.stats.registered = registeredNames.length;
    this.stats.registeredNames = registeredNames;

    this.logger.log(
      `工具发现完成: 注册 ${this.stats.registered} 个, 禁用 ${this.stats.disabled} 个, 无效 ${this.stats.invalid} 个`,
    );
  }

  /**
   * 获取工具元数据
   * @param instance 工具实例
   * @returns 工具元数据或 undefined
   */
  private getToolMetadata(instance: any): ToolMetadata | undefined {
    return Reflect.getMetadata(AGENT_TOOL, instance.constructor);
  }

  /**
   * 检查工具是否启用
   * @param metadata 工具元数据
   * @returns 是否启用
   */
  private isToolEnabled(metadata: ToolMetadata): boolean {
    if (metadata.enabled === false) {
      return false;
    }

    const configKey = `${TOOL_CONFIG_PREFIX}.${metadata.name}.enabled`;
    const configEnabled = this.config.get<boolean | string>(configKey, true);

    return configEnabled === true || configEnabled === 'true';
  }

  /**
   * 验证工具是否有效
   * @param instance 工具实例
   * @returns 是否有效
   */
  private isValidTool(instance: any): instance is IAgentTool {
    return (
      typeof instance.name === 'string' &&
      instance.name.length > 0 &&
      typeof instance.definition === 'object' &&
      typeof instance.execute === 'function'
    );
  }
}

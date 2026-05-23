import { Injectable, Logger } from '@nestjs/common';
import { ClientToolRegistry } from './client-tool-registry';
import { ClientToolModulePolicy, ToolPermissionPolicy } from './client-tool-entry';

/**
 * 用户自定义策略覆盖存储 key
 * 格式: `${moduleName}:${toolName}`
 * 实际项目中应持久化到数据库，此处先用内存存储
 */
type PolicyOverrideKey = `${string}:${string}`;

/**
 * 工具权限配置服务
 * 管理客户端工具的权限策略，支持用户覆盖默认策略
 *
 * 策略优先级：用户覆盖 > 模块默认策略
 */
@Injectable()
export class ClientToolPolicyService {
  private readonly logger = new Logger(ClientToolPolicyService.name);

  /** 用户对单个工具的策略覆盖 */
  private overrides = new Map<PolicyOverrideKey, Partial<ToolPermissionPolicy>>();

  /** 用户对模块级别的策略覆盖 */
  private moduleOverrides = new Map<string, Partial<Pick<ClientToolModulePolicy, 'defaultConfirmMode' | 'defaultTimeout'>>>();

  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  /**
   * 获取所有客户端工具模块的合并后权限策略
   * 将默认策略与用户覆盖合并
   * @returns {ClientToolModulePolicy[]} 合并后的策略列表
   */
  getAllPolicies(): ClientToolModulePolicy[] {
    const entries = this.clientToolRegistry.getAllEntries();
    const policies: ClientToolModulePolicy[] = [];

    for (const entry of entries) {
      const policy = this.getModulePolicy(entry.name);
      if (policy) policies.push(policy);
    }

    return policies;
  }

  /**
   * 获取指定模块的合并后权限策略
   * @param moduleName 模块名称
   * @returns {ClientToolModulePolicy | undefined} 合并后的策略
   */
  getModulePolicy(moduleName: string): ClientToolModulePolicy | undefined {
    const entry = this.clientToolRegistry.getEntryByName(moduleName);
    if (!entry?.defaultPolicy) return undefined;

    const base = entry.defaultPolicy;
    const mergedTools = base.tools.map(tool => {
      const override = this.overrides.get(`${base.moduleName}:${tool.toolName}` as PolicyOverrideKey);
      return override ? { ...tool, ...override } : { ...tool };
    });

    const moduleOverride = this.moduleOverrides.get(moduleName);

    return {
      ...base,
      tools: mergedTools,
      defaultConfirmMode: moduleOverride?.defaultConfirmMode ?? base.defaultConfirmMode,
      defaultTimeout: moduleOverride?.defaultTimeout ?? base.defaultTimeout,
    };
  }

  /**
   * 获取指定工具的合并后权限策略
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @returns {ToolPermissionPolicy | undefined} 合并后的策略
   */
  getToolPolicy(moduleName: string, toolName: string): ToolPermissionPolicy | undefined {
    const modulePolicy = this.getModulePolicy(moduleName);
    if (!modulePolicy) return undefined;

    const toolPolicy = modulePolicy.tools.find(t => t.toolName === toolName);
    if (toolPolicy) return toolPolicy;

    return {
      toolName,
      confirmMode: modulePolicy.defaultConfirmMode,
      timeout: modulePolicy.defaultTimeout,
    };
  }

  /**
   * 覆盖指定工具的权限策略
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @param override 策略覆盖
   */
  setToolPolicyOverride(
    moduleName: string,
    toolName: string,
    override: Partial<ToolPermissionPolicy>,
  ): void {
    this.overrides.set(`${moduleName}:${toolName}` as PolicyOverrideKey, override);
  }

  /**
   * 覆盖指定模块的默认策略
   * @param moduleName 模块名称
   * @param override 模块策略覆盖
   */
  setModulePolicyOverride(
    moduleName: string,
    override: Partial<Pick<ClientToolModulePolicy, 'defaultConfirmMode' | 'defaultTimeout'>>,
  ): void {
    this.moduleOverrides.set(moduleName, override);
  }

  /**
   * 删除指定工具的策略覆盖（恢复默认）
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @returns {boolean} 是否成功删除
   */
  deleteToolPolicyOverride(moduleName: string, toolName: string): boolean {
    return this.overrides.delete(`${moduleName}:${toolName}` as PolicyOverrideKey);
  }

  /**
   * 删除指定模块的策略覆盖（恢复默认）
   * @param moduleName 模块名称
   * @returns {boolean} 是否成功删除
   */
  deleteModulePolicyOverride(moduleName: string): boolean {
    return this.moduleOverrides.delete(moduleName);
  }

  /**
   * 重置所有策略覆盖（恢复全部默认）
   */
  resetAllOverrides(): void {
    this.overrides.clear();
    this.moduleOverrides.clear();
  }
}

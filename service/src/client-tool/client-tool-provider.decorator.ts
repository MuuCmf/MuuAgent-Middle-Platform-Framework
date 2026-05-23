import { CLIENT_TOOL_PROVIDER } from '../agent/tools/constants/tool.constants';
import { ClientToolEntry } from './client-tool-entry';

/**
 * 客户端工具提供者元数据
 */
export interface ClientToolProviderMetadata {
  /** 提供者名称（用于日志和标识） */
  name: string;
}

/**
 * 客户端工具提供者装饰器
 * 用于标记实现了 ClientToolEntry 接口的提供者类，支持自动发现和注册
 *
 * 新增客户端工具只需：
 * 1. 创建 Handler 类并使用 @ClientToolProvider 装饰器
 * 2. 实现 getClientToolEntry() 方法返回 ClientToolEntry
 * 3. 在模块的 providers 中添加 Handler 类
 * 4. ClientToolDiscoveryService 会自动发现并注册到 ClientToolRegistry
 *
 * @example
 * ```typescript
 * @ClientToolProvider({ name: 'workspace' })
 * @Injectable()
 * export class WorkspaceToolHandler implements IClientToolProvider {
 *   getClientToolEntry(): ClientToolEntry {
 *     return {
 *       name: 'workspace',
 *       toolNames: new Set(WORKSPACE_TOOLS.map(t => t.name)),
 *       toolDefinitions: WORKSPACE_TOOLS,
 *       isEnabled: (agent) => agent._workspaceEnabled === true,
 *       eventPrefix: 'WORKSPACE_TOOL',
 *       handler: this,
 *     };
 *   }
 * }
 * ```
 */
export function ClientToolProvider(metadata: ClientToolProviderMetadata): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(CLIENT_TOOL_PROVIDER, metadata, target);
  };
}

/**
 * 获取客户端工具提供者元数据
 * @param target 目标类
 * @returns 提供者元数据或 undefined
 */
export function getClientToolProviderMetadata(target: any): ClientToolProviderMetadata | undefined {
  return Reflect.getMetadata(CLIENT_TOOL_PROVIDER, target);
}

/**
 * 客户端工具提供者接口
 * 实现此接口的类可被 ClientToolDiscoveryService 自动发现并注册
 */
export interface IClientToolProvider {
  /**
   * 获取客户端工具注册条目
   * @returns 客户端工具注册条目
   */
  getClientToolEntry(): ClientToolEntry;
}

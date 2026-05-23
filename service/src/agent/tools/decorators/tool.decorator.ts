import { AGENT_TOOL, TOOL_DISPATCHER } from '../constants/tool.constants';

/**
 * 工具元数据
 */
export interface ToolMetadata {
  /** 工具名称 */
  name: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 优先级（数值越大优先级越高） */
  priority?: number;
  /** 工具分类 */
  category?: 'builtin' | 'skill-meta' | 'mcp' | 'kb' | 'workspace' | 'system_control';
}

/**
 * 工具装饰器
 * 用于标记工具类，支持自动发现和注册
 *
 * 新增工具只需：
 * 1. 创建工具类并使用 @AgentTool 装饰器
 * 2. 将工具类添加到 ToolModule 的 providers 中（NestJS 依赖注入需要）
 * 3. ToolDiscoveryService 会自动发现并注册到 ToolRegistry
 *
 * @example
 * ```typescript
 * @AgentTool({ name: 'http_request', enabled: true, category: 'builtin' })
 * export class HttpRequestTool extends BaseTool {
 *   // ...
 * }
 * ```
 */
export function AgentTool(metadata: ToolMetadata): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(AGENT_TOOL, metadata, target);
  };
}

/**
 * 获取工具元数据
 * @param target 目标类
 * @returns 工具元数据或 undefined
 */
export function getToolMetadata(target: any): ToolMetadata | undefined {
  return Reflect.getMetadata(AGENT_TOOL, target);
}

/**
 * 分发器元数据
 */
export interface DispatcherMetadata {
  /** 分发器名称（用于日志和标识） */
  name: string;
  /** 分发优先级（数值越小越先匹配），默认按注册顺序 */
  order?: number;
}

/**
 * 工具分发器装饰器
 * 用于标记分发器类，支持自动发现和注册到分发器链
 *
 * 新增分发器只需：
 * 1. 创建分发器类并使用 @ToolDispatcher 装饰器
 * 2. 将分发器类添加到 ToolModule 的 providers 中
 * 3. DispatcherCollector 会自动发现并收集到 TOOL_DISPATCHERS
 *
 * @example
 * ```typescript
 * @ToolDispatcher({ name: 'registered', order: 10 })
 * export class RegisteredToolDispatcher implements IToolDispatcher {
 *   // ...
 * }
 * ```
 */
export function ToolDispatcher(metadata: DispatcherMetadata): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(TOOL_DISPATCHER, metadata, target);
  };
}

/**
 * 获取分发器元数据
 * @param target 目标类
 * @returns 分发器元数据或 undefined
 */
export function getDispatcherMetadata(target: any): DispatcherMetadata | undefined {
  return Reflect.getMetadata(TOOL_DISPATCHER, target);
}

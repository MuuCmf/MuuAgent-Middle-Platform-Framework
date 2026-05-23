import { ToolDefinition } from '../agent/tools/abstract/tool.interface';
import { IClientToolHandler } from './client-tool-handler.interface';

/**
 * 单个工具的权限策略
 * 定义客户端工具在执行时的权限控制规则
 */
export interface ToolPermissionPolicy {
  /** 工具名称 */
  toolName: string;

  /**
   * 确认模式
   * - 'auto': 自动执行，无需用户确认
   * - 'confirm': 执行前需要用户确认
   * - 'deny': 禁止执行
   */
  confirmMode: 'auto' | 'confirm' | 'deny';

  /**
   * 确认提示消息模板
   * 支持 {args.xxx} 占位符，如 "确定要删除文件 {args.path} 吗？"
   */
  confirmMessage?: string;

  /**
   * 参数约束规则
   * key 为参数名，value 为约束条件
   */
  paramConstraints?: Record<string, ParamConstraint>;

  /**
   * 超时时间（毫秒）
   * 超时后自动取消执行
   */
  timeout?: number;
}

/**
 * 参数约束条件
 */
export interface ParamConstraint {
  /** 允许的值列表（白名单） */
  allowedValues?: unknown[];

  /** 禁止的值列表（黑名单） */
  deniedValues?: unknown[];

  /** 值的正则匹配模式（字符串类型） */
  pattern?: string;

  /** 最大长度（字符串类型） */
  maxLength?: number;

  /** 自定义校验表达式 */
  customValidator?: string;
}

/**
 * 客户端工具模块的权限策略集合
 * 由服务端定义默认策略，用户可通过管理界面覆盖
 */
export interface ClientToolModulePolicy {
  /** 模块名称，如 'workspace', 'system_control' */
  moduleName: string;

  /** 各工具的权限策略 */
  tools: ToolPermissionPolicy[];

  /** 模块级别的默认确认模式 */
  defaultConfirmMode: 'auto' | 'confirm' | 'deny';

  /** 模块级别的默认超时时间 */
  defaultTimeout: number;
}

/**
 * 客户端工具注册条目
 * 每个需要在客户端执行的工具类型都需要注册一个条目
 */
export interface ClientToolEntry {
  /** 注册名称，用于标识和日志，如 'workspace', 'browser' */
  name: string;

  /** 该类型下的所有工具名称集合 */
  toolNames: Set<string>;

  /** 工具定义列表（用于注入到 Agent 的工具列表） */
  toolDefinitions: ToolDefinition[];

  /** 判断是否为该 Agent 启用这些工具 */
  isEnabled: (agent: Record<string, any>) => boolean;

  /** SSE 事件前缀，如 'WORKSPACE_TOOL', 'BROWSER_TOOL' */
  eventPrefix: string;

  /** 客户端执行调度器（SSE下发 + Promise等待） */
  handler: IClientToolHandler;

  /**
   * 默认权限策略
   * 定义该模块下各工具的默认权限控制规则
   * 用户可通过管理界面覆盖这些策略
   */
  defaultPolicy?: ClientToolModulePolicy;
}

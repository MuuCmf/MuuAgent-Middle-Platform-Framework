import { ToolDefinition } from '../agent/tools/abstract/tool.interface';
import { IClientToolHandler } from './client-tool-handler.interface';

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
}

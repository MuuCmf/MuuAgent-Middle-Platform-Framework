import { AGENT_TOOL } from '../constants/tool.constants';

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
  category?: 'builtin' | 'skill-meta' | 'mcp' | 'kb' | 'workspace';
}

/**
 * 工具装饰器
 * 用于标记工具类，支持自动发现和注册
 *
 * @example
 * ```typescript
 * @AgentTool({ name: 'http_request', enabled: true })
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

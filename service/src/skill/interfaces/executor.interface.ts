/**
 * 统一执行器接口
 *
 * 所有技能/工具执行器均实现此接口，提供一致的 canExecute/execute 契约。
 * 消费者可通过 IExecutor[] 链进行分发，无需硬编码的名称匹配。
 */
export interface IExecutor {
  /** 执行器名称 */
  readonly name: string;

  /** 判断是否能执行指定的工具/函数 */
  canExecute(toolName: string): boolean;

  /** 执行工具/函数 */
  execute(args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }>;
}

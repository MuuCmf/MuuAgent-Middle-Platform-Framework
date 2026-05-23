/**
 * 单个工具的权限策略
 */
export interface ToolPermissionPolicy {
  /** 工具名称 */
  toolName: string
  /**
   * 确认模式
   * - 'auto': 自动执行，无需用户确认
   * - 'confirm': 执行前需要用户确认
   * - 'deny': 禁止执行
   */
  confirmMode: 'auto' | 'confirm' | 'deny'
  /** 确认提示消息模板 */
  confirmMessage?: string
  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 客户端工具模块的权限策略
 */
export interface ClientToolModulePolicy {
  /** 模块名称 */
  moduleName: string
  /** 模块默认确认模式 */
  defaultConfirmMode: 'auto' | 'confirm' | 'deny'
  /** 模块默认超时时间 */
  defaultTimeout: number
  /** 各工具的权限策略 */
  tools: ToolPermissionPolicy[]
}

/**
 * 客户端工具执行器接口
 * 每个客户端工具模块需要实现此接口以注册到路由器
 */
export interface IClientToolExecutor {
  /** 模块名称 */
  moduleName: string
  /**
   * 执行工具调用
   * @param call 工具调用载荷
   * @returns 执行结果
   */
  execute(call: import('../api/stream').ClientToolCallPayload): Promise<{
    callId: string
    success: boolean
    result?: unknown
    error?: string
  }>
}

/**
 * 工具调用裁决结果
 */
export interface ToolCallVerdict {
  /** 是否允许执行 */
  allowed: boolean
  /** 裁决原因 */
  reason: 'auto' | 'confirmed' | 'denied_by_policy' | 'denied_by_user' | 'no_policy'
  /** 确认消息（当需要用户确认时） */
  confirmMessage?: string
  /** 超时时间 */
  timeout?: number
}

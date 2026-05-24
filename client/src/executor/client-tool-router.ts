import type { ClientToolCallPayload } from '../api/stream'
import { submitClientToolResult } from '../api/client-tool'
import type {
  ClientToolModulePolicy,
  ToolPermissionPolicy,
  IClientToolExecutor,
  ToolCallVerdict,
} from './types'

/**
 * 客户端工具路由器
 *
 * 统一管理所有客户端工具的执行路由和权限拦截。
 * 替代 chat.ts 中硬编码的 if-else 分发逻辑。
 *
 * 职责：
 * 1. 注册执行器（替代硬编码 moduleName 判断）
 * 2. 存储服务端下发的权限策略
 * 3. 根据策略裁决工具调用（自动/确认/拒绝）
 * 4. 将调用路由到正确的执行器
 */
export class ClientToolRouter {
  /** 已注册的执行器映射 */
  private executors = new Map<string, IClientToolExecutor>()

  /** 服务端下发的权限策略 */
  private policies = new Map<string, ClientToolModulePolicy>()

  /** 用户本地覆盖的策略（优先级最高） */
  private localOverrides = new Map<string, Map<string, Partial<ToolPermissionPolicy>>>()

  /**
   * 注册执行器
   * @param executor 工具执行器
   */
  registerExecutor(executor: IClientToolExecutor): void {
    this.executors.set(executor.moduleName, executor)
  }

  /**
   * 注销执行器
   * @param moduleName 模块名称
   */
  unregisterExecutor(moduleName: string): void {
    this.executors.delete(moduleName)
  }

  /**
   * 更新服务端下发的权限策略
   * @param policies 策略列表
   */
  updatePolicies(policies: ClientToolModulePolicy[]): void {
    this.policies.clear()
    for (const policy of policies) {
      this.policies.set(policy.moduleName, policy)
    }
  }

  /**
   * 用户本地覆盖指定工具的策略
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @param override 策略覆盖
   */
  setLocalOverride(
    moduleName: string,
    toolName: string,
    override: Partial<ToolPermissionPolicy>,
  ): void {
    if (!this.localOverrides.has(moduleName)) {
      this.localOverrides.set(moduleName, new Map())
    }
    this.localOverrides.get(moduleName)!.set(toolName, override)
  }

  /**
   * 删除用户本地覆盖（恢复服务端策略）
   * @param moduleName 模块名称
   * @param toolName 工具名称
   */
  deleteLocalOverride(moduleName: string, toolName: string): void {
    this.localOverrides.get(moduleName)?.delete(toolName)
  }

  /**
   * 获取指定工具的合并后权限策略
   * 优先级：本地覆盖 > 服务端策略 > 默认
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @returns 权限策略
   */
  getToolPolicy(moduleName: string, toolName: string): ToolPermissionPolicy {
    const modulePolicy = this.policies.get(moduleName)
    const localOverride = this.localOverrides.get(moduleName)?.get(toolName)

    if (!modulePolicy) {
      return {
        toolName,
        confirmMode: 'confirm',
      }
    }

    const toolPolicy = modulePolicy.tools.find(t => t.toolName === toolName)

    const base: ToolPermissionPolicy = toolPolicy
      ? { ...toolPolicy }
      : {
          toolName,
          confirmMode: modulePolicy.defaultConfirmMode,
          timeout: modulePolicy.defaultTimeout,
        }

    if (localOverride) {
      return { ...base, ...localOverride }
    }

    return base
  }

  /**
   * 裁决工具调用
   * @param moduleName 模块名称
   * @param toolName 工具名称
   * @returns 裁决结果
   */
  judge(moduleName: string, toolName: string): ToolCallVerdict {
    const policy = this.getToolPolicy(moduleName, toolName)

    switch (policy.confirmMode) {
      case 'auto':
        return {
          allowed: true,
          reason: 'auto',
          timeout: policy.timeout,
        }
      case 'confirm':
        return {
          allowed: true,
          reason: 'confirmed',
          confirmMessage: policy.confirmMessage || `确定要执行 ${toolName} 吗？`,
          timeout: policy.timeout,
        }
      case 'deny':
        return {
          allowed: false,
          reason: 'denied_by_policy',
        }
      default:
        return {
          allowed: true,
          reason: 'no_policy',
        }
    }
  }

  /**
   * 处理客户端工具调用
   * 统一入口：裁决 → 确认 → 路由 → 执行 → 回传结果
   * @param call 工具调用载荷
   * @param confirmFn 确认函数（由 UI 层提供）
   * @param conversationId 会话ID（用于结果回传）
   * @returns 执行结果
   */
  async handleCall(
    call: ClientToolCallPayload,
    confirmFn: (message: string) => Promise<boolean>,
    conversationId?: string | null,
  ): Promise<{
    callId: string
    success: boolean
    result?: unknown
    error?: string
  }> {
    const { moduleName, toolName, callId } = call

    const verdict = this.judge(moduleName, toolName)

    if (!verdict.allowed) {
      const result = {
        callId,
        success: false,
        error: `工具 ${toolName} 已被策略禁止执行`,
      }
      this.submitResult(callId, conversationId, result)
      return result
    }

    if (verdict.reason === 'confirmed' && verdict.confirmMessage) {
      const confirmMessage = this.interpolateMessage(verdict.confirmMessage, call.args)
      const confirmed = await confirmFn(confirmMessage)
      if (!confirmed) {
        const result = {
          callId,
          success: false,
          error: '用户取消了操作',
        }
        this.submitResult(callId, conversationId, result)
        return result
      }
    }

    const executor = this.executors.get(moduleName)
    if (!executor) {
      const result = {
        callId,
        success: false,
        error: `未注册的客户端工具模块: ${moduleName}`,
      }
      this.submitResult(callId, conversationId, result)
      return result
    }

/** 执行工具调用 */
    let result: { callId: string; success: boolean; result?: unknown; error?: string }
    try {
      result = await executor.execute(call)
    } catch (e: any) {
      console.error(`[ClientToolRouter] 执行器异常 [${moduleName}/${toolName}]:`, e)
      result = {
        callId,
        success: false,
        error: e.message || `执行器异常: ${toolName}`,
      }
    }

    /** 回传结果到 Service（无论成功失败都回传） */
    this.submitResult(callId, conversationId, result)
    return result
  }

  /**
   * 统一提交执行结果到服务端
   * @param callId 调用ID
   * @param conversationId 会话ID（可选，如果 Resend 或历史消息回放可能为空）
   * @param result 执行结果
   */
  private async submitResult(
    callId: string,
    conversationId: string | null | undefined,
    result: { callId: string; success: boolean; result?: unknown; error?: string },
  ): Promise<void> {
    if (!conversationId) {
      console.warn(`[ClientToolRouter] 缺少 conversationId，无法回传结果 [${callId}]:`, result.error || 'success')
      return
    }
    try {
      await submitClientToolResult({
        conversationId,
        callId: result.callId,
        success: result.success,
        result: result.result,
        error: result.error,
      })
    } catch (e) {
      console.error('[ClientToolRouter] 提交结果失败:', e)
    }
  }

  /**
   * 获取所有已注册的模块名称
   * @returns 模块名称列表
   */
  getRegisteredModules(): string[] {
    return Array.from(this.executors.keys())
  }

  /**
   * 获取所有权限策略
   * @returns 策略列表
   */
  getAllPolicies(): ClientToolModulePolicy[] {
    return Array.from(this.policies.values())
  }

  /**
   * 插值确认消息模板
   * 支持 {args.xxx} 占位符
   * @param template 消息模板
   * @param args 工具参数
   * @returns 插值后的消息
   */
  private interpolateMessage(template: string, args: Record<string, unknown>): string {
    return template.replace(/\{args\.(\w+)\}/g, (_, key) => {
      const value = args[key]
      return value !== undefined ? String(value) : `{args.${key}}`
    })
  }
}

/** 全局客户端工具路由器实例 */
export const clientToolRouter = new ClientToolRouter()

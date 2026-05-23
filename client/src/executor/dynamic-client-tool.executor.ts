import type { ClientToolCallPayload } from '../api/stream'
import type { IClientToolExecutor } from './types'
import { dynamicPluginRegistry } from './dynamic-plugin-registry'

/**
 * 动态客户端工具执行器
 *
 * 接收 SSE 下发的动态工具调用，通过插件注册表查找执行模板并执行。
 * 与 workspace 等硬编码执行器不同，此执行器：
 * 1. 从 dynamicPluginRegistry 查找工具的执行模板
 * 2. 根据模板类型（http_request/script/command）执行
 * 3. 结果回传由 ClientToolRouter 统一处理
 */
export class DynamicClientToolExecutor implements IClientToolExecutor {
  /** 模块名称 */
  moduleName = 'dynamic' as const

  /**
   * 执行动态客户端工具调用
   * @param call 客户端工具调用载荷
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  async execute(call: ClientToolCallPayload): Promise<{
    /** 调用ID */
    callId: string;
    /** 是否成功 */
    success: boolean;
    /** 执行结果 */
    result?: unknown;
    /** 错误信息 */
    error?: string;
  }> {
    const { callId, toolName, args } = call

    const plugin = dynamicPluginRegistry.get(toolName)
    if (!plugin) {
      return {
        callId,
        success: false,
        error: `未注册的动态工具: ${toolName}，请先同步工具定义`,
      }
    }

    try {
      const result = await dynamicPluginRegistry.execute(toolName, args)
      return { callId, success: true, result }
    } catch (e: any) {
      return { callId, success: false, error: e.message }
    }
  }
}

/** 全局动态客户端工具执行器实例 */
export const dynamicClientToolExecutor = new DynamicClientToolExecutor()

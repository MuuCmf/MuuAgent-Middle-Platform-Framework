import type { ClientToolCallPayload } from '../api/stream'
import { submitSystemControlResult } from '../api/system-control'

/**
 * 系统控制工具执行器
 * 接收 SSE 下发的系统控制工具调用，通过 Electron IPC 执行，并回传结果
 */
export class SystemControlExecutor {
  /** 当前会话ID */
  private conversationId: string = ''

  /**
   * 设置当前会话ID
   * @param id 会话ID
   */
  setConversationId(id: string): void {
    this.conversationId = id
  }

  /**
   * 执行系统控制工具调用
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

    /** 检查是否在 Electron 环境中运行 */
    const electronAPI = (window as any).electronAPI
    if (!electronAPI) {
      return {
        callId,
        success: false,
        error: '当前不在 Electron 桌面环境中，无法执行系统控制操作',
      }
    }

    try {
      const result = await electronAPI.systemControl(toolName, args)

      /** 回传结果给服务端 */
      await submitSystemControlResult(this.conversationId, {
        callId,
        success: result.success,
        result: result.result,
        error: result.error,
      })

      return { callId, success: result.success, result: result.result, error: result.error }
    } catch (e: any) {
      /** 回传错误结果给服务端 */
      await submitSystemControlResult(this.conversationId, {
        callId,
        success: false,
        error: e.message,
      })

      return { callId, success: false, error: e.message }
    }
  }
}

/** 全局系统控制执行器实例 */
export const systemControlExecutor = new SystemControlExecutor()

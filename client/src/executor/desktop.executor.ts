import type { ClientToolCallPayload } from '../api/stream'
import type { IClientToolExecutor } from './types'

/**
 * 桌面自动化执行器
 *
 * 接收 SSE 下发的桌面工具调用，通过 IPC 转发到 Electron 主进程执行。
 * 仅在 Desktop 客户端环境下可用，普通浏览器中返回错误。
 *
 * 通信链路：
 * SSE [CLIENT_TOOL:desktop] → clientToolRouter → DesktopExecutor → IPC → Electron main
 * → DesktopMcpServer → nut-js → 系统操作 → 结果回传
 */
export class DesktopExecutor implements IClientToolExecutor {
  /** 模块名称 */
  moduleName = 'desktop' as const

  /**
   * 执行桌面工具调用
   * @param call 客户端工具调用载荷
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  async execute(call: ClientToolCallPayload): Promise<{
    callId: string
    success: boolean
    result?: unknown
    error?: string
  }> {
    const { callId, toolName, args } = call

    if (!window.electronAPI?.executeDesktopTool) {
      return {
        callId,
        success: false,
        error: `桌面自动化工具仅在 Desktop 客户端中可用（当前为浏览器环境）`,
      }
    }

    try {
      return await window.electronAPI.executeDesktopTool(callId, toolName, args)
    } catch (e: any) {
      return {
        callId,
        success: false,
        error: e.message || '桌面工具执行失败',
      }
    }
  }
}
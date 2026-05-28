import type { ClientToolCallPayload } from '../api/stream'
import type { IClientToolExecutor } from './types'

/**
 * 浏览器自动化执行器
 *
 * 接收 SSE 下发的浏览器工具调用，通过 IPC 转发到 Electron 主进程执行。
 * 仅在 Desktop 客户端环境下可用，普通浏览器中返回错误。
 *
 * 通信链路：
 * SSE [CLIENT_TOOL:browser] → clientToolRouter → BrowserExecutor → IPC → Electron main
 * → BrowserMcpServer → Puppeteer → 浏览器操作 → 结果回传
 */
export class BrowserExecutor implements IClientToolExecutor {
  /** 模块名称 */
  moduleName = 'browser' as const

  /**
   * 执行浏览器工具调用
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

    if (!window.electronAPI?.executeBrowserTool) {
      return {
        callId,
        success: false,
        error: `浏览器自动化工具仅在 Desktop 客户端中可用（当前为浏览器环境）`,
      }
    }

    try {
      return await window.electronAPI.executeBrowserTool(callId, toolName, args)
    } catch (e: any) {
      return {
        callId,
        success: false,
        error: e.message || '浏览器工具执行失败',
      }
    }
  }
}
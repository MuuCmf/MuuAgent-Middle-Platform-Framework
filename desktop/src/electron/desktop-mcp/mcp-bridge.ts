import { BrowserWindow } from 'electron'
import { DesktopMcpServer } from './server'
import { AutomationConfig } from './types'

/**
 * MCP Bridge — 工具执行桥接器

 * 负责：
 * 1. 管理本地 MCP Server 实例
 * 2. 设置安全确认回调（通过 IPC 弹窗）
 * 3. 通过 getServer() 暴露 MCP Server 供 IPC handler 调用
 *
 * 工具调用链路：
 * Service → Browser SSE → clientToolRouter → DesktopExecutor
 * → IPC → main.ts handler → server.callTool()
 * → 结果由浏览器端 POST /agent/chat/client-tool-result 回传
 */
export class McpBridge {
  /** 本地 MCP Server 实例 */
  private mcpServer: DesktopMcpServer
  /** Electron 主窗口引用（用于弹出确认窗口） */
  private mainWindow: BrowserWindow | null

  /**
   * @param options 初始化选项
   * @param options.config 自动化配置
   * @param options.mainWindow Electron 主窗口
   */
  constructor(options: {
    config: AutomationConfig
    mainWindow: BrowserWindow | null
  }) {
    this.mainWindow = options.mainWindow

    /** 初始化 MCP Server */
    this.mcpServer = new DesktopMcpServer(options.config)

    /** 设置确认回调：通过 IPC 弹窗 */
    this.mcpServer.setConfirmCallback(async (toolName, description) => {
      return this.showConfirmDialog(toolName, description)
    })
  }

  /**
   * 启动 Bridge
   * 打印就绪日志，不再建立独立 SSE 连接
   */
  start(): void {
    console.log(`[McpBridge] 启动，本地工具已就绪: ${this.mcpServer.getTools().map(t => t.name).join(', ')}`)
  }

  /**
   * 停止 Bridge
   */
  stop(): void {
    console.log('[McpBridge] 已停止')
  }

  /**
   * 获取 MCP Server 实例（供外部查询日志）
   * @returns {DesktopMcpServer}
   */
  getServer(): DesktopMcpServer {
    return this.mcpServer
  }

  /**
   * 弹出安全确认对话框
   * @param toolName 工具名称
   * @param description 操作描述
   * @returns {Promise<boolean>} 用户是否确认
   */
  private async showConfirmDialog(toolName: string, description: string): Promise<boolean> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('[McpBridge] 无法弹出确认窗口：主窗口不可用')
      return false
    }

    const timeout = this.mcpServer['config'].confirmTimeout * 1000

    try {
      /** 通过 IPC 等待渲染进程的确认结果 */
      const confirmPromise = new Promise<boolean>((resolve) => {
        const { ipcMain } = require('electron')
        const channel = `automation:confirm:response:${Date.now()}`

        const handler = (_event: Electron.IpcMainEvent, confirmed: boolean) => {
          ipcMain.removeListener(channel, handler)
          resolve(confirmed)
        }

        ipcMain.once(channel, handler)

        this.mainWindow?.webContents.send('automation:confirm:request', {
          toolName,
          description,
          channel,
        })
      })

      return await this.withTimeout(confirmPromise, timeout)
    } catch {
      return false
    }
  }

  /**
   * Promise 超时包装
   * @param promise 原始 Promise
   * @param ms 超时时间
   * @returns {Promise<T>}
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('超时')), ms)),
    ])
  }
}
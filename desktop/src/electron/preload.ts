import { contextBridge, ipcRenderer } from 'electron'

/**
 * 通过 contextBridge 暴露给渲染进程的安全 API
 * 渲染进程只能调用此处显式暴露的方法，无法直接访问 ipcRenderer
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 获取系统信息（只读）
   * @returns {Promise<unknown>} 系统信息
   */
  getSystemInfo: (): Promise<unknown> => {
    return ipcRenderer.invoke('system:info')
  },

  /**
   * 执行桌面自动化工具
   * 将工具调用转发到 Electron 主进程的 DesktopMcpServer 执行
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  executeDesktopTool: async (
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ callId: string; success: boolean; result?: unknown; error?: string }> => {
    return ipcRenderer.invoke('desktop:execute-tool', { callId, toolName, args })
  },

  /**
   * 监听主进程事件
   * @param channel 事件频道
   * @param callback 回调函数
   */
  onMainEvent: (channel: string, callback: (...args: unknown[]) => void): void => {
    const allowedChannels = [
      'voice:status',
      'update:available',
      'update:progress',
      'update:downloaded',
      'automation:confirm:request',
    ]
    if (!allowedChannels.includes(channel)) return
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },

  /**
   * 移除主进程事件监听
   * @param channel 事件频道
   * @param callback 回调函数
   */
  removeMainEventListener: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback as any)
  },

  /**
   * 桌面自动化确认弹窗响应
   * @param confirmed 用户是否确认
   * @param channel 回传频道
   */
  respondAutomationConfirm: (confirmed: boolean, channel: string): void => {
    ipcRenderer.send('automation:confirm:response', { channel, confirmed })
  },
})
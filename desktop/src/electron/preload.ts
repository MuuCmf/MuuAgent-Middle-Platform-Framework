import { contextBridge, ipcRenderer } from 'electron'

/**
 * 通过 contextBridge 暴露给渲染进程的安全 API
 * 渲染进程只能调用此处显式暴露的方法，无法直接访问 ipcRenderer
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 执行系统控制工具
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<unknown>} 执行结果
   */
  systemControl: (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
    return ipcRenderer.invoke('system-control:execute', { toolName, args })
  },

  /**
   * 获取系统信息（只读）
   * @returns {Promise<unknown>} 系统信息
   */
  getSystemInfo: (): Promise<unknown> => {
    return ipcRenderer.invoke('system:info')
  },

  /**
   * 监听主进程事件（如确认弹窗响应）
   * @param channel 事件频道
   * @param callback 回调函数
   */
  onMainEvent: (channel: string, callback: (...args: unknown[]) => void): void => {
    const allowedChannels = [
      'system-control:confirm',
      'system-control:progress',
      'voice:status',
      'update:available',
      'update:progress',
      'update:downloaded',
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
})

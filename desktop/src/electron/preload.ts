import { contextBridge, ipcRenderer, webUtils } from 'electron'

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
   * 执行浏览器自动化工具
   * 将工具调用转发到 Electron 主进程的 BrowserMcpServer 执行
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  executeBrowserTool: async (
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ callId: string; success: boolean; result?: unknown; error?: string }> => {
    return ipcRenderer.invoke('browser:execute-tool', { callId, toolName, args })
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

  /**
   * 打开本地文件或目录（使用系统默认应用）
   * @param filePath 文件或目录的完整路径
   * @returns {Promise<{success: boolean; error?: string}>} 打开结果
   */
  openLocalPath: (filePath: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('shell:open-path', filePath)
  },

  /**
   * 选择工作目录（使用 Electron dialog，返回完整路径）
   * @returns {Promise<{path: string; name: string} | null>} 目录路径和名称，用户取消时返回 null
   */
  selectDirectory: (): Promise<{ path: string; name: string } | null> => {
    return ipcRenderer.invoke('dialog:select-directory')
  },

  /**
   * 获取 File 对象的完整路径（Electron 28+ API）
   * @param file File 对象
   * @returns 文件完整路径
   */
  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file)
  },

  /**
   * 读取目录结构（返回文件树）
   * @param dirPath 目录完整路径
   * @returns 文件树节点数组
   */
  readDirTree: (dirPath: string): Promise<any[]> => {
    return ipcRenderer.invoke('fs:read-dir-tree', dirPath)
  },
})
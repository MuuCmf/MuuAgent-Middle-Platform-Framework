export interface ElectronAPI {
  /**
   * 获取系统信息
   * @returns {Promise<{platform: string; arch: string; hostname: string; username: string}>} 系统信息
   */
  getSystemInfo(): Promise<{
    /** 操作系统平台 */
    platform: string
    /** CPU 架构 */
    arch: string
    /** 主机名 */
    hostname: string
    /** 用户名 */
    username: string
  }>

  /**
   * 执行桌面自动化工具
   * 将工具调用转发到 Electron 主进程的 DesktopMcpServer 执行
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  executeDesktopTool(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    /** 调用ID */
    callId: string
    /** 是否成功 */
    success: boolean
    /** 执行结果 */
    result?: unknown
    /** 错误信息 */
    error?: string
  }>

  /**
   * 执行浏览器自动化工具
   * 将工具调用转发到 Electron 主进程的 BrowserMcpServer 执行
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<{callId: string; success: boolean; result?: unknown; error?: string}>} 执行结果
   */
  executeBrowserTool(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    /** 调用ID */
    callId: string
    /** 是否成功 */
    success: boolean
    /** 执行结果 */
    result?: unknown
    /** 错误信息 */
    error?: string
  }>

  /**
   * 监听主进程事件
   * @param channel 事件频道
   * @param callback 回调函数
   */
  onMainEvent(channel: string, callback: (...args: unknown[]) => void): void

  /**
   * 移除主进程事件监听
   * @param channel 事件频道
   * @param callback 回调函数
   */
  removeMainEventListener(channel: string, callback: (...args: unknown[]) => void): void

  /**
   * 桌面自动化确认弹窗响应
   * @param confirmed 用户是否确认
   * @param channel 回传频道
   */
  respondAutomationConfirm(confirmed: boolean, channel: string): void

  /**
   * 打开本地文件或目录（使用系统默认应用）
   * @param filePath 文件或目录的完整路径
   * @returns {Promise<{success: boolean; error?: string}>} 打开结果
   */
  openLocalPath(filePath: string): Promise<{
    /** 是否成功 */
    success: boolean
    /** 错误信息 */
    error?: string
  }>

  /**
   * 选择工作目录（使用 Electron dialog，返回完整路径）
   * @returns {Promise<{path: string; name: string} | null>} 目录路径和名称，用户取消时返回 null
   */
  selectDirectory(): Promise<{
    /** 目录完整路径 */
    path: string
    /** 目录名称 */
    name: string
  } | null>

  /**
   * 获取 File 对象的完整路径（Electron 28+ API）
   * @param file File 对象
   * @returns 文件完整路径
   */
  getPathForFile(file: File): string

  /**
   * 读取目录结构（返回文件树）
   * @param dirPath 目录完整路径
   * @returns 文件树节点数组
   */
  readDirTree(dirPath: string): Promise<{
    name: string
    kind: 'file' | 'directory'
    children?: any[]
    extension?: string
    relativePath: string
  }[]>
}

declare global {
  interface Window {
    /** Electron 主进程暴露的安全 API */
    electronAPI: ElectronAPI
  }
}
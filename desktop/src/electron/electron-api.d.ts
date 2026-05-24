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
}

declare global {
  interface Window {
    /** Electron 主进程暴露的安全 API */
    electronAPI: ElectronAPI
  }
}
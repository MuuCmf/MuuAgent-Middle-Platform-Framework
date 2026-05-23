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
}

declare global {
  interface Window {
    /** Electron 主进程暴露的安全 API */
    electronAPI: ElectronAPI
  }
}

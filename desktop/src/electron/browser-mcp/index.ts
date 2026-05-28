import { BrowserBridge } from './browser-bridge'
import { BrowserConfig, DEFAULT_BROWSER_CONFIG } from './types'
import { BrowserWindow } from 'electron'

/**
 * Browser MCP 模块入口
 * 负责读取配置并启动 Browser Bridge
 * 与 DesktopMcpModule 完全独立，不共享任何代码
 */
export class BrowserMcpModule {
  /** Browser Bridge 实例 */
  private bridge: BrowserBridge | null = null

  /**
   * 启动浏览器自动化模块
   * @param config 浏览器自动化配置（合并默认值）
   * @param mainWindow Electron 主窗口
   * @returns {BrowserBridge} Browser Bridge 实例
   */
  async start(
    config: Partial<BrowserConfig>,
    mainWindow: BrowserWindow | null,
  ): Promise<BrowserBridge> {
    const mergedConfig: BrowserConfig = {
      ...DEFAULT_BROWSER_CONFIG,
      ...config,
    }

    console.log('[BrowserMcpModule] 初始化浏览器自动化模块')
    console.log(`[BrowserMcpModule] 启用状态: ${mergedConfig.enabled}`)
    console.log(`[BrowserMcpModule] 频率限制: ${mergedConfig.rateLimit} 次/分钟`)
    console.log(`[BrowserMcpModule] 需确认操作: ${mergedConfig.requireConfirm.join(', ') || '无'}`)
    console.log(`[BrowserMcpModule] 最大页面数: ${mergedConfig.maxPages}`)
    console.log(`[BrowserMcpModule] 域名黑名单: ${mergedConfig.domainBlacklist.join(', ') || '无'}`)
    console.log(`[BrowserMcpModule] 域名白名单: ${mergedConfig.domainWhitelist.join(', ') || '无'}`)
    console.log(`[BrowserMcpModule] 允许脚本执行: ${mergedConfig.allowScriptExecution}`)

    this.bridge = new BrowserBridge({
      config: mergedConfig,
      mainWindow,
    })

    this.bridge.start()

    return this.bridge
  }

  /**
   * 停止浏览器自动化模块
   */
  async stop(): Promise<void> {
    if (this.bridge) {
      await this.bridge.stop()
      this.bridge = null
    }
    console.log('[BrowserMcpModule] 浏览器自动化模块已停止')
  }

  /**
   * 获取 Browser Bridge 实例
   * @returns {BrowserBridge | null}
   */
  getBridge(): BrowserBridge | null {
    return this.bridge
  }
}
import { McpBridge } from './mcp-bridge'
import { AutomationConfig, DEFAULT_AUTOMATION_CONFIG } from './types'
import { BrowserWindow } from 'electron'

/**
 * Desktop MCP 模块入口
 * 负责读取配置并启动 MCP Bridge
 */
export class DesktopMcpModule {
  /** MCP Bridge 实例 */
  private bridge: McpBridge | null = null

  /**
   * 启动桌面自动化模块
   * @param config 自动化配置（合并默认值）
   * @param mainWindow Electron 主窗口
   * @returns {McpBridge} MCP Bridge 实例
   */
  async start(
    config: Partial<AutomationConfig>,
    mainWindow: BrowserWindow | null,
  ): Promise<McpBridge> {
    const mergedConfig: AutomationConfig = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...config,
    }

    console.log('[DesktopMcpModule] 初始化桌面自动化模块')
    console.log(`[DesktopMcpModule] 启用状态: ${mergedConfig.enabled}`)
    console.log(`[DesktopMcpModule] 频率限制: ${mergedConfig.rateLimit} 次/分钟`)
    console.log(`[DesktopMcpModule] 需确认操作: ${mergedConfig.requireConfirm.join(', ') || '无'}`)

    this.bridge = new McpBridge({
      config: mergedConfig,
      mainWindow,
    })

    this.bridge.start()

    return this.bridge
  }

  /**
   * 停止桌面自动化模块
   */
  stop(): void {
    if (this.bridge) {
      this.bridge.stop()
      this.bridge = null
    }
    console.log('[DesktopMcpModule] 桌面自动化模块已停止')
  }

  /**
   * 获取 MCP Bridge 实例
   * @returns {McpBridge | null}
   */
  getBridge(): McpBridge | null {
    return this.bridge
  }
}
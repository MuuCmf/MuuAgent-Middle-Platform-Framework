import { BrowserManager } from './browser-manager'
import { DomainFilter } from './security/domain-filter'
import { RateLimiter } from './security/rate-limiter'
import { ScriptSecurityChecker } from './security/script-security'
import { navigateHandler } from './tools/navigate'
import { screenshotHandler } from './tools/screenshot'
import { clickHandler } from './tools/click'
import { fillHandler } from './tools/fill'
import { evaluateHandler } from './tools/evaluate'
import { waitHandler } from './tools/wait'
import { scrollHandler } from './tools/scroll'
import { getContentHandler } from './tools/get-content'
import { selectHandler } from './tools/select'
import { hoverHandler } from './tools/hover'
import { closeHandler } from './tools/close'
import { BrowserConfig, BrowserToolResult, BrowserToolDefinition, BrowserLogEntry } from './types'

/** 工具名称到处理函数的映射表 */
type ToolHandler = (args: any, manager: BrowserManager) => Promise<BrowserToolResult>

/** callTool 调用选项 */
interface CallToolOptions {
  /** 跳过安全确认弹窗（浏览器端已通过 clientToolRouter 处理确认） */
  skipConfirm?: boolean
}

/**
 * Browser MCP Server — 浏览器工具执行引擎
 * 负责注册浏览器自动化工具并执行对应的 handler。
 * 与 DesktopMcpServer 完全独立，不共享任何代码。
 */
export class BrowserMcpServer {
  /** 工具名称 → handler 映射 */
  private handlers = new Map<string, ToolHandler>()
  /** 工具定义列表 */
  private toolDefinitions: BrowserToolDefinition[] = []
  /** 浏览器实例管理器 */
  private browserManager: BrowserManager
  /** 域名过滤器 */
  private domainFilter: DomainFilter
  /** 频率限制器 */
  private rateLimiter: RateLimiter
  /** 脚本安全检查器 */
  private scriptSecurityChecker: ScriptSecurityChecker
  /** 浏览器自动化配置 */
  private config: BrowserConfig
  /** 操作日志记录 */
  private logEntries: BrowserLogEntry[] = []
  /** 安全确认回调（由 Bridge 注入，用于弹窗确认） */
  private confirmCallback: ((toolName: string, description: string) => Promise<boolean>) | null = null

  /**
   * @param config 浏览器自动化配置
   */
  constructor(config: BrowserConfig) {
    this.config = config
    this.browserManager = new BrowserManager(config)
    this.domainFilter = new DomainFilter(config.domainBlacklist, config.domainWhitelist)
    this.rateLimiter = new RateLimiter(config.rateLimit)
    this.scriptSecurityChecker = new ScriptSecurityChecker()
    this.registerTools()
  }

  /**
   * 注册所有 11 个浏览器自动化工具
   */
  private registerTools(): void {
    this.handlers.set('browser_navigate', navigateHandler)
    this.handlers.set('browser_screenshot', screenshotHandler)
    this.handlers.set('browser_click', clickHandler)
    this.handlers.set('browser_fill', fillHandler)
    this.handlers.set('browser_evaluate', evaluateHandler)
    this.handlers.set('browser_wait', waitHandler)
    this.handlers.set('browser_scroll', scrollHandler)
    this.handlers.set('browser_get_content', getContentHandler)
    this.handlers.set('browser_select', selectHandler)
    this.handlers.set('browser_hover', hoverHandler)
    this.handlers.set('browser_close', closeHandler)

    this.toolDefinitions = [
      {
        name: 'browser_navigate',
        description: '导航到指定 URL。支持多种等待条件。',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '目标 URL' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            waitUntil: { type: 'string', description: '等待条件：load / domcontentloaded / networkidle0 / networkidle2' },
            timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_screenshot',
        description: '截取浏览器页面截图。支持 PNG、JPEG、WebP 格式。',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            format: { type: 'string', description: '截图格式：png / jpeg / webp' },
            quality: { type: 'number', description: '图片质量（jpeg/webp），0-100' },
            maxWidth: { type: 'number', description: '最大宽度像素，默认 1280' },
            fullPage: { type: 'boolean', description: '是否截取整个页面' },
            selector: { type: 'string', description: '元素选择器（截取特定元素）' },
          },
        },
      },
      {
        name: 'browser_click',
        description: '点击页面上的元素。',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: '元素选择器' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            clickCount: { type: 'number', description: '点击次数，默认 1' },
            delay: { type: 'number', description: '点击延迟（毫秒）' },
            offsetX: { type: 'number', description: '点击位置偏移 X' },
            offsetY: { type: 'number', description: '点击位置偏移 Y' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_fill',
        description: '填充表单字段。',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: '元素选择器' },
            value: { type: 'string', description: '要填充的值' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            clear: { type: 'boolean', description: '是否清空现有内容，默认 true' },
            delay: { type: 'number', description: '输入延迟（毫秒）' },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'browser_evaluate',
        description: '在页面中执行 JavaScript 脚本。',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: '要执行的脚本' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            timeout: { type: 'number', description: '脚本执行超时时间（毫秒），默认 30000' },
          },
          required: ['script'],
        },
      },
      {
        name: 'browser_wait',
        description: '等待特定条件满足。',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: '等待类型：selector / timeout / function / navigation' },
            target: { type: 'string', description: '等待目标（selector 类型为选择器）' },
            timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            waitUntil: { type: 'string', description: '等待条件（navigation 类型）' },
          },
          required: ['type'],
        },
      },
      {
        name: 'browser_scroll',
        description: '滚动页面。',
        inputSchema: {
          type: 'object',
          properties: {
            direction: { type: 'string', description: '滚动方向：up / down / left / right / top / bottom' },
            distance: { type: 'number', description: '滚动距离（像素），默认 300' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            selector: { type: 'string', description: '滚动到指定元素' },
          },
          required: ['direction'],
        },
      },
      {
        name: 'browser_get_content',
        description: '获取页面内容。',
        inputSchema: {
          type: 'object',
          properties: {
            contentType: { type: 'string', description: '内容类型：text / html / markdown / json' },
            selector: { type: 'string', description: '元素选择器（可选）' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            includeHidden: { type: 'boolean', description: '是否包含隐藏元素' },
          },
          required: ['contentType'],
        },
      },
      {
        name: 'browser_select',
        description: '选择下拉框选项。',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: '下拉框选择器' },
            value: { type: 'string', description: '要选择的值' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
            selectBy: { type: 'string', description: '选择方式：value / text / index' },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'browser_hover',
        description: '悬停在页面元素上。',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: '元素选择器' },
            pageId: { type: 'string', description: '页面标识，默认为 default' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_close',
        description: '关闭浏览器或页面。',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: '页面标识（关闭特定页面）' },
            closeBrowser: { type: 'boolean', description: '是否关闭整个浏览器，默认 false' },
          },
        },
      },
    ]
  }

  /**
   * 获取所有工具定义
   * @returns {BrowserToolDefinition[]} 工具定义列表
   */
  getTools(): BrowserToolDefinition[] {
    return this.toolDefinitions
  }

  /**
   * 设置安全确认回调
   * @param callback 确认回调函数
   */
  setConfirmCallback(callback: (toolName: string, description: string) => Promise<boolean>): void {
    this.confirmCallback = callback
  }

  /**
   * 调用工具（由 Browser Bridge 直接调用）
   * @param toolName 工具名称
   * @param args 工具参数
   * @param options 调用选项
   * @returns {Promise<BrowserToolResult>} 执行结果
   */
  async callTool(toolName: string, args: Record<string, unknown>, options?: CallToolOptions): Promise<BrowserToolResult> {
    const handler = this.handlers.get(toolName)
    if (!handler) {
      return { content: [{ type: 'text', text: `未知工具: ${toolName}` }], isError: true }
    }

    /** 安全检查链 */
    const checkResult = await this.runSecurityChain(toolName, args, options)
    if (!checkResult.allowed) {
      return { content: [{ type: 'text', text: checkResult.reason || '操作被安全策略拦截' }], isError: true }
    }

    /** 执行工具 */
    const startTime = Date.now()
    const result = await handler(args, this.browserManager)

    /** 记录日志 */
    if (this.config.enableLog) {
      this.logOperation(toolName, args, result, Date.now() - startTime, args.pageId as string)
    }

    return result
  }

  /**
   * 安全链检查
   * @param toolName 工具名称
   * @param args 工具参数
   * @param options 调用选项
   * @returns {{ allowed: boolean; reason?: string }} 检查结果
   */
  private async runSecurityChain(
    toolName: string,
    args: Record<string, unknown>,
    options?: CallToolOptions,
  ): Promise<{ allowed: boolean; reason?: string }> {
    /** 总开关检查 */
    if (!this.config.enabled) {
      return { allowed: false, reason: '浏览器自动化未启用' }
    }

    /** 频率限制检查 */
    if (!this.rateLimiter.tryAcquire()) {
      return { allowed: false, reason: `操作频率超限（每分钟最多 ${this.config.rateLimit} 次）` }
    }

    /** 域名过滤检查（仅对 navigate 工具） */
    if (toolName === 'browser_navigate' && args.url) {
      if (!this.domainFilter.isAllowed(args.url as string)) {
        const reason = this.domainFilter.getRejectReason(args.url as string)
        return { allowed: false, reason: reason || `域名访问被拒绝: ${args.url}` }
      }
    }

    /** 脚本执行权限检查 */
    if (toolName === 'browser_evaluate') {
      if (!this.config.allowScriptExecution) {
        return { allowed: false, reason: '脚本执行未启用' }
      }
      /** 脚本安全检查 */
      if (args.script && !this.scriptSecurityChecker.isSafe(args.script as string)) {
        const reason = this.scriptSecurityChecker.getUnsafeReason(args.script as string)
        return { allowed: false, reason: reason || '脚本包含危险内容' }
      }
    }

    /** 确认弹窗检查 */
    if (!options?.skipConfirm) {
      const actionType = getActionType(toolName)
      if (actionType && this.config.requireConfirm.includes(actionType)) {
        if (this.confirmCallback) {
          const description = buildConfirmDescription(toolName, args)
          const confirmed = await this.confirmCallback(toolName, description)
          if (!confirmed) {
            return { allowed: false, reason: '用户取消了操作' }
          }
        }
      }
    }

    return { allowed: true }
  }

  /**
   * 记录操作日志
   * @param toolName 工具名称
   * @param args 工具参数
   * @param result 执行结果
   * @param durationMs 执行耗时
   * @param pageId 页面标识
   */
  private logOperation(toolName: string, args: unknown, result: BrowserToolResult, durationMs: number, pageId?: string): void {
    const entry: BrowserLogEntry = {
      time: new Date().toISOString(),
      tool: toolName,
      args,
      result: result.isError ? `失败(${durationMs}ms)` : `成功(${durationMs}ms)`,
      pageId,
    }
    this.logEntries.push(entry)
    /** 只保留最近 1000 条日志 */
    if (this.logEntries.length > 1000) {
      this.logEntries = this.logEntries.slice(-500)
    }
    console.log(`[BrowserMCP] ${entry.time} ${entry.tool} — ${entry.result}`)
  }

  /**
   * 获取操作日志
   * @param limit 返回条数限制
   * @returns {BrowserLogEntry[]} 日志条目
   */
  getLogs(limit = 50): BrowserLogEntry[] {
    return this.logEntries.slice(-limit)
  }

  /**
   * 获取浏览器状态
   * @returns {Promise<import('./types').BrowserState>} 浏览器状态
   */
  async getBrowserState(): Promise<import('./types').BrowserState> {
    return this.browserManager.getState()
  }

  /**
   * 清理资源（关闭浏览器）
   */
  async cleanup(): Promise<void> {
    await this.browserManager.cleanup()
  }

  /**
   * 更新浏览器自动化配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<BrowserConfig>): void {
    if (config.enabled !== undefined) this.config.enabled = config.enabled
    if (config.requireConfirm !== undefined) this.config.requireConfirm = config.requireConfirm
    if (config.confirmTimeout !== undefined) this.config.confirmTimeout = config.confirmTimeout
    if (config.rateLimit !== undefined) {
      this.config.rateLimit = config.rateLimit
      this.rateLimiter.updateLimit(config.rateLimit)
    }
    if (config.maxPages !== undefined) this.config.maxPages = config.maxPages
    if (config.pageTimeout !== undefined) this.config.pageTimeout = config.pageTimeout
    if (config.domainBlacklist !== undefined) {
      this.config.domainBlacklist = config.domainBlacklist
      this.domainFilter.setBlacklist(config.domainBlacklist)
    }
    if (config.domainWhitelist !== undefined) {
      this.config.domainWhitelist = config.domainWhitelist
      this.domainFilter.setWhitelist(config.domainWhitelist)
    }
    if (config.allowScriptExecution !== undefined) this.config.allowScriptExecution = config.allowScriptExecution
    if (config.enableLog !== undefined) this.config.enableLog = config.enableLog
    if (config.chromiumArgs !== undefined) this.config.chromiumArgs = config.chromiumArgs

    /** 更新 BrowserManager 配置 */
    this.browserManager.updateConfig(this.config)
  }
}

/**
 * 根据工具名称获取操作类型
 * @param toolName 工具名称
 * @returns {'navigate' | 'evaluate' | 'fill' | null} 操作类型
 */
function getActionType(toolName: string): 'navigate' | 'evaluate' | 'fill' | null {
  if (toolName === 'browser_navigate') return 'navigate'
  if (toolName === 'browser_evaluate') return 'evaluate'
  if (toolName === 'browser_fill') return 'fill'
  return null
}

/**
 * 构建确认弹窗的描述文本
 * @param toolName 工具名称
 * @param args 工具参数
 * @returns {string} 描述文本
 */
function buildConfirmDescription(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'browser_navigate':
      return `导航到: ${args.url}`
    case 'browser_evaluate':
      return `⚠️ 执行脚本: ${(args.script as string || '').substring(0, 50)}`
    case 'browser_fill':
      return `在 ${args.selector} 中填写内容`
    default:
      return `执行工具: ${toolName}`
  }
}
import { RateLimiter } from './security/rate-limiter'
import { CommandBlacklist } from './security/command-blacklist'
import { screenshotHandler } from './tools/screenshot'
import { mouseHandler } from './tools/mouse'
import { keyboardHandler } from './tools/keyboard'
import { executeHandler, setExecuteBlacklist } from './tools/execute'
import { clipboardHandler } from './tools/clipboard'
import { windowHandler } from './tools/window'
import { AutomationConfig, ToolArgs, ToolResult, ToolDefinition } from './types'

/** 工具名称到处理函数的映射表 */
type ToolHandler = (args: any) => Promise<ToolResult>

/** callTool 调用选项 */
interface CallToolOptions {
  /** 跳过安全确认弹窗（浏览器端已通过 clientToolRouter 处理确认） */
  skipConfirm?: boolean
}

/**
 * Desktop MCP Server — 本地工具执行引擎
 * 负责注册桌面自动化工具并执行对应的 handler。
 * 由 MCP Bridge 在进程内直接调用，无需 stdio 通信开销。
 */
export class DesktopMcpServer {
  /** 工具名称 → handler 映射 */
  private handlers = new Map<string, ToolHandler>()
  /** 工具定义列表 */
  private toolDefinitions: ToolDefinition[] = []
  /** 频率限制器 */
  private rateLimiter: RateLimiter
  /** 命令黑名单 */
  private commandBlacklist: CommandBlacklist
  /** 自动化配置 */
  private config: AutomationConfig
  /** 操作日志记录 */
  private logEntries: Array<{ time: string; tool: string; args: unknown; result: string }> = []
  /** 安全确认回调（由 Bridge 注入，用于弹窗确认） */
  private confirmCallback: ((toolName: string, description: string) => Promise<boolean>) | null = null

  /**
   * @param config 自动化配置
   */
  constructor(config: AutomationConfig) {
    this.config = config
    this.rateLimiter = new RateLimiter(config.rateLimit)
    this.commandBlacklist = new CommandBlacklist(config.commandBlacklist)
    setExecuteBlacklist(this.commandBlacklist)
    this.registerTools()
  }

  /**
   * 注册所有 6 个桌面自动化工具
   */
  private registerTools(): void {
    this.handlers.set('desktop_screenshot', screenshotHandler)
    this.handlers.set('desktop_mouse', mouseHandler)
    this.handlers.set('desktop_keyboard', keyboardHandler)
    this.handlers.set('desktop_execute', executeHandler)
    this.handlers.set('desktop_clipboard', clipboardHandler)
    this.handlers.set('desktop_window', windowHandler)

    this.toolDefinitions = [
      {
        name: 'desktop_screenshot',
        description: '截取当前屏幕，返回 Base64 编码图片。支持指定显示器索引和输出格式，默认缩放至 1280px 宽以减少 token 消耗。',
        inputSchema: {
          type: 'object',
          properties: {
            screen: { type: 'number', description: '显示器索引，0 为主显示器' },
            format: { type: 'string', description: '输出格式：png / jpg，默认 png' },
            maxWidth: { type: 'number', description: '最大宽度像素，默认 1280' },
          },
        },
      },
      {
        name: 'desktop_mouse',
        description: '鼠标操作：点击、移动、拖拽、滚动、获取位置。通过 action 参数区分具体操作。',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: '操作类型：left_click / right_click / double_click / move / drag / scroll / position' },
            x: { type: 'number', description: '目标 X 坐标' },
            y: { type: 'number', description: '目标 Y 坐标' },
            endX: { type: 'number', description: '拖拽终点 X' },
            endY: { type: 'number', description: '拖拽终点 Y' },
            scrollX: { type: 'number', description: '水平滚动量' },
            scrollY: { type: 'number', description: '垂直滚动量' },
          },
          required: ['action'],
        },
      },
      {
        name: 'desktop_keyboard',
        description: '键盘操作：输入文本、按键、组合键。通过 action 参数区分具体操作。',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: '操作类型：type / press / shortcut' },
            text: { type: 'string', description: '要输入的文本（action=type 时使用）' },
            keys: { type: 'array', description: '按键列表（action=shortcut 时使用，如 ["Control", "c"]）' },
          },
          required: ['action'],
        },
      },
      {
        name: 'desktop_execute',
        description: '执行终端命令并返回输出。危险命令会被黑名单拦截。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            cwd: { type: 'string', description: '工作目录' },
            timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
          },
          required: ['command'],
        },
      },
      {
        name: 'desktop_clipboard',
        description: '剪贴板操作：读取、写入。通过 action 参数区分具体操作。',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: '操作类型：read / write' },
            content: { type: 'string', description: '要写入的内容（action=write 时使用）' },
          },
          required: ['action'],
        },
      },
      {
        name: 'desktop_window',
        description: '窗口管理：列出所有窗口、获取当前活动窗口信息。通过 action 参数区分具体操作。',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: '操作类型：list / active' },
            title: { type: 'string', description: '窗口标题过滤（action=list 时使用）' },
          },
          required: ['action'],
        },
      },
    ]
  }

  /**
   * 获取所有工具定义
   * @returns {ToolDefinition[]} 工具定义列表
   */
  getTools(): ToolDefinition[] {
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
   * 调用工具（由 MCP Bridge 直接调用）
   * @param toolName 工具名称
   * @param args 工具参数
   * @param options 调用选项
   * @returns {Promise<ToolResult>} 执行结果
   */
  async callTool(toolName: string, args: Record<string, unknown>, options?: CallToolOptions): Promise<ToolResult> {
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
    const result = await handler(args)

    /** 记录日志 */
    if (this.config.enableLog) {
      this.logOperation(toolName, args, result, Date.now() - startTime)
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
      return { allowed: false, reason: '桌面自动化未启用' }
    }

    /** 频率限制检查 */
    if (!this.rateLimiter.tryAcquire()) {
      return { allowed: false, reason: `操作频率超限（每分钟最多 ${this.config.rateLimit} 次）` }
    }

    /** 确认弹窗检查（可通过 options.skipConfirm 跳过） */
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

    /** 命令黑名单检查（execute 工具内部处理） */

    return { allowed: true }
  }

  /**
   * 记录操作日志
   * @param toolName 工具名称
   * @param args 工具参数
   * @param result 执行结果
   * @param durationMs 执行耗时
   */
  private logOperation(toolName: string, args: unknown, result: ToolResult, durationMs: number): void {
    const entry = {
      time: new Date().toISOString(),
      tool: toolName,
      args,
      result: result.isError ? `失败(${durationMs}ms)` : `成功(${durationMs}ms)`,
    }
    this.logEntries.push(entry)
    /** 只保留最近 1000 条日志 */
    if (this.logEntries.length > 1000) {
      this.logEntries = this.logEntries.slice(-500)
    }
    console.log(`[DesktopMCP] ${entry.time} ${entry.tool} — ${entry.result}`)
  }

  /**
   * 获取操作日志
   * @param limit 返回条数限制
   * @returns {Array} 日志条目
   */
  getLogs(limit = 50): typeof this.logEntries {
    return this.logEntries.slice(-limit)
  }

  /**
   * 更新自动化配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<AutomationConfig>): void {
    if (config.enabled !== undefined) this.config.enabled = config.enabled
    if (config.requireConfirm !== undefined) this.config.requireConfirm = config.requireConfirm
    if (config.confirmTimeout !== undefined) this.config.confirmTimeout = config.confirmTimeout
    if (config.rateLimit !== undefined) {
      this.config.rateLimit = config.rateLimit
      this.rateLimiter.updateLimit(config.rateLimit)
    }
    if (config.commandBlacklist !== undefined) {
      this.config.commandBlacklist = config.commandBlacklist
      this.commandBlacklist.setPatterns(config.commandBlacklist)
    }
    if (config.enableLog !== undefined) this.config.enableLog = config.enableLog
  }
}

/**
 * 根据工具名称获取操作类型
 * @param toolName 工具名称
 * @returns {'mouse' | 'keyboard' | 'execute' | 'clipboard' | null} 操作类型
 */
function getActionType(toolName: string): 'mouse' | 'keyboard' | 'execute' | 'clipboard' | null {
  if (toolName === 'desktop_mouse') return 'mouse'
  if (toolName === 'desktop_keyboard') return 'keyboard'
  if (toolName === 'desktop_execute') return 'execute'
  if (toolName === 'desktop_clipboard') return 'clipboard'
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
    case 'desktop_mouse': {
      const action = args.action || 'click'
      const x = args.x
      const y = args.y
      return x !== undefined && y !== undefined
        ? `鼠标操作: ${action} (${x}, ${y})`
        : `鼠标操作: ${action}`
    }
    case 'desktop_keyboard': {
      const action = args.action
      if (action === 'type') return `键盘输入: ${(args.text as string || '').substring(0, 50)}`
      if (action === 'shortcut') return `组合键: ${(args.keys as string[] || []).join(' + ')}`
      return `键盘操作: ${action}`
    }
    case 'desktop_execute':
      return `执行命令: ${(args.command as string || '').substring(0, 100)}`
    case 'desktop_clipboard': {
      if (args.action === 'write') return `写入剪贴板: ${(args.content as string || '').substring(0, 50)}`
      return `读取剪贴板`
    }
    default:
      return `执行工具: ${toolName}`
  }
}
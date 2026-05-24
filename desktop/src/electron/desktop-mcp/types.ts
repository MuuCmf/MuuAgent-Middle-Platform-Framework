/**
 * 桌面自动化 - 统一类型定义
 */

/** 截图工具参数 */
export interface ScreenshotArgs {
  /** 显示器索引，0 为主显示器 */
  screen?: number
  /** 输出格式 */
  format?: 'png' | 'jpg'
  /** 最大宽度像素，默认 1280 */
  maxWidth?: number
}

/** 鼠标操作动作类型 */
export type MouseAction = 'left_click' | 'right_click' | 'double_click' | 'move' | 'drag' | 'scroll' | 'position'

/** 鼠标工具参数 */
export interface MouseArgs {
  /** 操作动作 */
  action: MouseAction
  /** 目标 X 坐标（基于截图分辨率的坐标） */
  x?: number
  /** 目标 Y 坐标（基于截图分辨率的坐标） */
  y?: number
  /** 拖拽终点 X */
  endX?: number
  /** 拖拽终点 Y */
  endY?: number
  /** 水平滚动量 */
  scrollX?: number
  /** 垂直滚动量 */
  scrollY?: number
  /** 截图对应的屏幕实际宽度（用于坐标映射，不传则按截图分辨率=实际分辨率处理） */
  screenWidth?: number
  /** 截图对应的屏幕实际高度 */
  screenHeight?: number
}

/** 键盘操作动作类型 */
export type KeyboardAction = 'type' | 'press' | 'shortcut'

/** 键盘工具参数 */
export interface KeyboardArgs {
  /** 操作动作 */
  action: KeyboardAction
  /** 输入的文本（action=type 时使用） */
  text?: string
  /** 按键列表（action=shortcut 时使用，如 ["Control", "c"]） */
  keys?: string[]
}

/** 命令执行工具参数 */
export interface ExecuteArgs {
  /** 要执行的命令 */
  command: string
  /** 工作目录 */
  cwd?: string
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number
}

/** 剪贴板操作动作类型 */
export type ClipboardAction = 'read' | 'write'

/** 剪贴板工具参数 */
export interface ClipboardArgs {
  /** 操作动作 */
  action: ClipboardAction
  /** 写入的内容（action=write 时使用） */
  content?: string
}

/** 窗口管理操作动作类型 */
export type WindowAction = 'list' | 'active'

/** 窗口管理工具参数 */
export interface WindowArgs {
  /** 操作动作 */
  action: WindowAction
  /** 窗口标题过滤（action=list 时使用） */
  title?: string
}

/** 所有工具参数联合类型 */
export type ToolArgs =
  | ScreenshotArgs
  | MouseArgs
  | KeyboardArgs
  | ExecuteArgs
  | ClipboardArgs
  | WindowArgs

/** MCP 工具调用结果 */
export interface ToolResult {
  /** 内容列表（MCP 标准格式） */
  content: Array<{
    /** 内容类型 */
    type: 'text' | 'image'
    /** 文本内容 */
    text?: string
    /** Base64 数据（image 类型） */
    data?: string
    /** MIME 类型（image 类型） */
    mimeType?: string
  }>
  /** 是否出错 */
  isError?: boolean
}

/** MCP 工具定义中的参数 schema */
export interface ToolParameterSchema {
  type: string
  description?: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

/** MCP 工具定义 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, ToolParameterSchema>
    required?: string[]
  }
}

/** 自动化配置 */
export interface AutomationConfig {
  /** 是否启用桌面自动化（总开关） */
  enabled: boolean
  /** 需要用户确认的操作类型列表 */
  requireConfirm: ('mouse' | 'keyboard' | 'execute' | 'clipboard')[]
  /** 确认超时时间（秒），超时自动拒绝 */
  confirmTimeout: number
  /** 操作频率限制（次/分钟），0 表示不限制 */
  rateLimit: number
  /** 命令执行黑名单（正则表达式） */
  commandBlacklist: string[]
  /** 是否记录操作日志 */
  enableLog: boolean
}

/** 自动化配置默认值 */
export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  enabled: false,
  requireConfirm: ['execute'],
  confirmTimeout: 60,
  rateLimit: 30,
  commandBlacklist: [
    'rm\\s+-rf',
    'Format-Volume',
    'del\\s+/[fs]',
    'shutdown',
    'Restart-Computer',
  ],
  enableLog: true,
}

/** SSE 下发的工具调用消息 */
export interface ToolCallMessage {
  /** 调用ID */
  callId: string
  /** 工具名称 */
  toolName: string
  /** 工具参数 */
  args: Record<string, unknown>
}

/** 工具执行回传结果 */
export interface ToolCallResponse {
  /** 调用ID */
  callId: string
  /** 是否成功 */
  success: boolean
  /** 执行结果 */
  result?: unknown
  /** 错误信息 */
  error?: string
}
/**
 * 浏览器自动化 - 统一类型定义
 * 与桌面自动化完全独立，不共享任何类型
 */

/** 导航工具参数 */
export interface NavigateArgs {
  /** 目标 URL */
  url: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 等待条件：load / domcontentloaded / networkidle0 / networkidle2 */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number
}

/** 浏览器截图工具参数 */
export interface BrowserScreenshotArgs {
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 输出格式：png / jpeg / webp */
  format?: 'png' | 'jpeg' | 'webp'
  /** 图片质量（jpeg/webp 格式），0-100 */
  quality?: number
  /** 最大宽度像素，默认 1280 */
  maxWidth?: number
  /** 是否截取整个页面（包括滚动区域） */
  fullPage?: boolean
  /** 元素选择器（截取特定元素） */
  selector?: string
}

/** 点击工具参数 */
export interface ClickArgs {
  /** 元素选择器 */
  selector: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 点击次数，默认 1 */
  clickCount?: number
  /** 点击延迟（毫秒） */
  delay?: number
  /** 点击位置偏移 X */
  offsetX?: number
  /** 点击位置偏移 Y */
  offsetY?: number
}

/** 填充表单工具参数 */
export interface FillArgs {
  /** 元素选择器 */
  selector: string
  /** 要填充的值 */
  value: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 是否清空现有内容，默认 true */
  clear?: boolean
  /** 输入延迟（毫秒） */
  delay?: number
}

/** 执行脚本工具参数 */
export interface EvaluateArgs {
  /** 要执行的 JavaScript 脚本 */
  script: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 脚本执行超时时间（毫秒），默认 30000 */
  timeout?: number
}

/** 等待工具参数 */
export interface WaitArgs {
  /** 等待类型：selector / timeout / function / navigation */
  type: 'selector' | 'timeout' | 'function' | 'navigation'
  /** 等待目标（selector 类型为选择器，function 类型为函数表达式） */
  target?: string
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 等待条件（navigation 类型） */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

/** 滚动工具参数 */
export interface ScrollArgs {
  /** 滚动方向：up / down / left / right / top / bottom */
  direction: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom'
  /** 滚动距离（像素），默认 300 */
  distance?: number
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 滚动到指定元素 */
  selector?: string
}

/** 获取内容工具参数 */
export interface GetContentArgs {
  /** 内容类型：text / html / markdown / json */
  contentType: 'text' | 'html' | 'markdown' | 'json'
  /** 元素选择器（可选，不传则获取整个页面） */
  selector?: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 是否包含隐藏元素 */
  includeHidden?: boolean
}

/** 下拉选择工具参数 */
export interface SelectArgs {
  /** 下拉框选择器 */
  selector: string
  /** 要选择的值 */
  value: string
  /** 页面标识，默认为 'default' */
  pageId?: string
  /** 选择方式：value / text / index */
  selectBy?: 'value' | 'text' | 'index'
}

/** 悬停工具参数 */
export interface HoverArgs {
  /** 元素选择器 */
  selector: string
  /** 页面标识，默认为 'default' */
  pageId?: string
}

/** 关闭浏览器工具参数 */
export interface CloseArgs {
  /** 页面标识（关闭特定页面） */
  pageId?: string
  /** 是否关闭整个浏览器，默认 false */
  closeBrowser?: boolean
}

/** 所有浏览器工具参数联合类型 */
export type BrowserToolArgs =
  | NavigateArgs
  | BrowserScreenshotArgs
  | ClickArgs
  | FillArgs
  | EvaluateArgs
  | WaitArgs
  | ScrollArgs
  | GetContentArgs
  | SelectArgs
  | HoverArgs
  | CloseArgs

/** MCP 工具调用结果 */
export interface BrowserToolResult {
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
export interface BrowserToolParameterSchema {
  type: string
  description?: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

/** MCP 工具定义 */
export interface BrowserToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, BrowserToolParameterSchema>
    required?: string[]
  }
}

/** 浏览器自动化配置 */
export interface BrowserConfig {
  /** 是否启用浏览器自动化（总开关） */
  enabled: boolean
  /** 需要用户确认的操作类型列表 */
  requireConfirm: ('navigate' | 'evaluate' | 'fill')[]
  /** 确认超时时间（秒），超时自动拒绝 */
  confirmTimeout: number
  /** 操作频率限制（次/分钟），0 表示不限制 */
  rateLimit: number
  /** 最大页面数量 */
  maxPages: number
  /** 页面超时时间（毫秒） */
  pageTimeout: number
  /** 域名黑名单（正则表达式） */
  domainBlacklist: string[]
  /** 域名白名单（正则表达式） */
  domainWhitelist: string[]
  /** 是否允许脚本执行 */
  allowScriptExecution: boolean
  /** 是否记录操作日志 */
  enableLog: boolean
  /** Chromium 启动参数 */
  chromiumArgs: string[]
}

/** 浏览器自动化配置默认值 */
export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  enabled: true,
  requireConfirm: ['navigate', 'evaluate'],
  confirmTimeout: 60,
  rateLimit: 20,
  maxPages: 5,
  pageTimeout: 30000,
  domainBlacklist: [],
  domainWhitelist: [],
  allowScriptExecution: false,
  enableLog: true,
  chromiumArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
}

/** 页面状态 */
export interface PageState {
  /** 页面标识 */
  pageId: string
  /** 当前 URL */
  url: string
  /** 页面标题 */
  title: string
  /** 创建时间 */
  createdAt: Date
  /** 最后活动时间 */
  lastActivityAt: Date
  /** 是否活跃 */
  isActive: boolean
}

/** 浏览器实例状态 */
export interface BrowserState {
  /** 是否已启动 */
  isRunning: boolean
  /** 页面列表 */
  pages: PageState[]
  /** 当前活跃页面 */
  activePageId: string | null
  /** 启动时间 */
  startedAt: Date | null
}

/** 操作日志条目 */
export interface BrowserLogEntry {
  /** 时间戳 */
  time: string
  /** 工具名称 */
  tool: string
  /** 工具参数 */
  args: unknown
  /** 执行结果 */
  result: string
  /** 页面标识 */
  pageId?: string
}
import type { Browser, Page, LaunchOptions, Target } from 'puppeteer-core'
import { BrowserConfig, PageState, BrowserState } from './types'

/** Puppeteer 启动选项类型（兼容旧版本） */
type BrowserLaunchOptions = LaunchOptions & {
  defaultViewport?: {
    width?: number
    height?: number
  }
}

/** Puppeteer 模块类型（动态导入后） */
interface PuppeteerModule {
  launch: (options: LaunchOptions) => Promise<Browser>
}

/**
 * 浏览器实例管理器
 * 负责创建、复用和销毁浏览器实例
 * 支持多页面管理、资源优化和崩溃恢复
 * 
 * 注意：puppeteer-core 是 ES Module，需要使用动态导入
 */
export class BrowserManager {
  /** 浏览器实例 */
  private browser: Browser | null = null
  /** 页面实例映射 */
  private pages = new Map<string, Page>()
  /** 配置选项 */
  private config: BrowserConfig
  /** 启动时间 */
  private startedAt: Date | null = null
  /** 是否正在启动 */
  private isLaunching = false
  /** 启动 Promise（防止重复启动） */
  private launchPromise: Promise<Browser> | null = null
  /** Puppeteer 模块缓存 */
  private puppeteer: PuppeteerModule | null = null

  /**
   * @param config 浏览器自动化配置
   */
  constructor(config: BrowserConfig) {
    this.config = config
  }

  /**
   * 动态导入 puppeteer-core 模块
   * 使用 new Function() 绕过 TypeScript 的静态分析，
   * 确保 CommonJS 环境下能正确导入 ES Module
   * @returns {Promise<PuppeteerModule>} Puppeteer 模块
   */
  private async loadPuppeteer(): Promise<PuppeteerModule> {
    if (this.puppeteer) {
      return this.puppeteer!
    }
    /** 使用 new Function() 绕过 TypeScript 转换，保持真正的动态导入 */
    const dynamicImport = new Function('modulePath', 'return import(modulePath)')
    this.puppeteer = await dynamicImport('puppeteer-core')
    return this.puppeteer!
  }

  /**
   * 获取或创建浏览器实例
   * @param options 启动选项
   * @returns {Promise<Browser>} 浏览器实例
   */
  async getBrowser(options?: BrowserLaunchOptions): Promise<Browser> {
    /** 如果浏览器已存在且连接正常，直接返回 */
    if (this.browser && this.browser.connected) {
      return this.browser
    }

    /** 如果正在启动，等待启动完成 */
    if (this.isLaunching && this.launchPromise) {
      return this.launchPromise
    }

    /** 启动新浏览器 */
    this.isLaunching = true
    this.launchPromise = this.launchBrowser(options)

    try {
      this.browser = await this.launchPromise
      this.startedAt = new Date()
      this.setupBrowserEventHandlers()
      console.log('[BrowserManager] 浏览器启动成功')
      return this.browser
    } catch (error) {
      console.error('[BrowserManager] 浏览器启动失败:', error)
      this.isLaunching = false
      this.launchPromise = null
      throw error
    } finally {
      this.isLaunching = false
      this.launchPromise = null
    }
  }

  /**
   * 启动浏览器
   * @param options 启动选项
   * @returns {Promise<Browser>} 浏览器实例
   */
  private async launchBrowser(options?: BrowserLaunchOptions): Promise<Browser> {
    /** 动态导入 puppeteer-core */
    const puppeteer = await this.loadPuppeteer()

    const launchOptions: BrowserLaunchOptions = {
      headless: false,
      args: this.config.chromiumArgs,
      defaultViewport: {
        width: 1280,
        height: 800,
      },
      ignoreDefaultArgs: ['--enable-automation'],
      ...options,
    }

    /** 尝试使用系统安装的 Chrome */
    try {
      const browser = await puppeteer.launch({
        ...launchOptions,
        executablePath: this.getChromeExecutablePath(),
      })
      return browser
    } catch (error) {
      console.warn('[BrowserManager] 使用系统 Chrome 失败，尝试使用 Puppeteer Chromium:', error)
      /** 如果系统 Chrome 不可用，尝试使用 Puppeteer 自带的 Chromium */
      const browser = await puppeteer.launch(launchOptions)
      return browser
    }
  }

  /**
   * 获取 Chrome 可执行文件路径
   * @returns {string | undefined} Chrome 路径
   */
  private getChromeExecutablePath(): string | undefined {
    const platform = process.platform

    if (platform === 'win32') {
      /** Windows 常见 Chrome 路径 */
      const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      ]
      return paths.find(p => p && require('fs').existsSync(p))
    } else if (platform === 'darwin') {
      /** macOS Chrome 路径 */
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    } else if (platform === 'linux') {
      /** Linux Chrome 路径 */
      const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ]
      return paths.find(p => require('fs').existsSync(p))
    }

    return undefined
  }

  /**
   * 设置浏览器事件处理器
   */
  private setupBrowserEventHandlers(): void {
    if (!this.browser) return

    /** 监听浏览器断开连接 */
    this.browser.on('disconnected', () => {
      console.log('[BrowserManager] 浏览器断开连接')
      this.browser = null
      this.pages.clear()
      this.startedAt = null
    })

    /** 监听新页面创建 */
    this.browser.on('targetcreated', async (target: Target) => {
      if (target.type() === 'page') {
        const page = await target.page()
        if (page) {
          console.log('[BrowserManager] 新页面创建')
        }
      }
    })

    /** 监听页面销毁 */
    this.browser.on('targetdestroyed', (target: Target) => {
      if (target.type() === 'page') {
        console.log('[BrowserManager] 页面销毁')
      }
    })
  }

  /**
   * 创建新页面
   * @param pageId 页面标识
   * @returns {Promise<Page>} 页面实例
   */
  async createPage(pageId: string = 'default'): Promise<Page> {
    /** 检查页面数量限制 */
    if (this.pages.size >= this.config.maxPages) {
      throw new Error(`页面数量已达上限（最多 ${this.config.maxPages} 个）`)
    }

    /** 如果页面已存在，返回现有页面 */
    if (this.pages.has(pageId)) {
      return this.pages.get(pageId)!
    }

    /** 获取浏览器实例 */
    const browser = await this.getBrowser()

    /** 创建新页面 */
    const page = await browser.newPage()

    /** 设置页面超时 */
    page.setDefaultTimeout(this.config.pageTimeout)

    /** 设置页面事件处理器 */
    this.setupPageEventHandlers(page, pageId)

    /** 存储页面实例 */
    this.pages.set(pageId, page)

    console.log(`[BrowserManager] 创建页面: ${pageId}`)
    return page
  }

  /**
   * 设置页面事件处理器
   * @param page 页面实例
   * @param pageId 页面标识
   */
  private setupPageEventHandlers(page: Page, pageId: string): void {
    /** 监听页面关闭 */
    page.on('close', () => {
      this.pages.delete(pageId)
      console.log(`[BrowserManager] 页面关闭: ${pageId}`)
    })

    /** 监听页面错误 */
    page.on('error', (error: Error) => {
      console.error(`[BrowserManager] 页面错误 (${pageId}):`, error)
    })

    /** 监听页面崩溃 */
    page.on('pageerror', (error: unknown) => {
      console.error(`[BrowserManager] 页面脚本错误 (${pageId}):`, error)
    })
  }

  /**
   * 获取页面实例
   * @param pageId 页面标识
   * @returns {Promise<Page>} 页面实例
   */
  async getPage(pageId: string = 'default'): Promise<Page> {
    /** 如果页面已存在，返回现有页面 */
    if (this.pages.has(pageId)) {
      const page = this.pages.get(pageId)!
      /** 检查页面是否已关闭 */
      if (page.isClosed()) {
        this.pages.delete(pageId)
        return this.createPage(pageId)
      }
      return page
    }

    /** 创建新页面 */
    return this.createPage(pageId)
  }

  /**
   * 关闭特定页面
   * @param pageId 页面标识
   */
  async closePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId)
    if (page && !page.isClosed()) {
      await page.close()
      this.pages.delete(pageId)
      console.log(`[BrowserManager] 关闭页面: ${pageId}`)
    }
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(): Promise<void> {
    if (this.browser && this.browser.connected) {
      await this.browser.close()
      console.log('[BrowserManager] 关闭浏览器')
    }
    this.browser = null
    this.pages.clear()
    this.startedAt = null
  }

  /**
   * 获取浏览器状态
   * @returns {BrowserState} 浏览器状态
   */
  async getState(): Promise<BrowserState> {
    const pageStates: PageState[] = []

    for (const [pageId, page] of this.pages) {
      if (!page.isClosed()) {
        try {
          const url = page.url()
          const title = await page.title()
          pageStates.push({
            pageId,
            url,
            title,
            createdAt: new Date(),
            lastActivityAt: new Date(),
            isActive: true,
          })
        } catch {
          /** 页面可能已关闭或出错 */
          pageStates.push({
            pageId,
            url: '',
            title: '',
            createdAt: new Date(),
            lastActivityAt: new Date(),
            isActive: false,
          })
        }
      }
    }

    return {
      isRunning: this.browser !== null && this.browser.connected,
      pages: pageStates,
      activePageId: this.pages.size > 0 ? 'default' : null,
      startedAt: this.startedAt,
    }
  }

  /**
   * 获取所有页面标识
   * @returns {string[]} 页面标识列表
   */
  getPageIds(): string[] {
    return Array.from(this.pages.keys())
  }

  /**
   * 检查浏览器是否运行
   * @returns {boolean} 是否运行
   */
  isRunning(): boolean {
    return this.browser !== null && this.browser.connected
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser()
  }

  /**
   * 更新配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<BrowserConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }
}
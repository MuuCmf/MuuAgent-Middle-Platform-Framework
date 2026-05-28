import { BrowserManager } from '../browser-manager'
import { HoverArgs, BrowserToolResult } from '../types'

/**
 * 悬停工具处理器
 * @param args 悬停参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function hoverHandler(args: HoverArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { selector, pageId = 'default' } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 等待元素出现 */
    await page.waitForSelector(selector, { timeout: 10000 })

    /** 悬停在元素上 */
    await page.hover(selector)

    return {
      content: [
        {
          type: 'text',
          text: `悬停成功: ${selector}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `悬停失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
import { BrowserManager } from '../browser-manager'
import { ClickArgs, BrowserToolResult } from '../types'

/**
 * 点击工具处理器
 * @param args 点击参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function clickHandler(args: ClickArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const {
    selector,
    pageId = 'default',
    clickCount = 1,
    delay = 0,
    offsetX = 0,
    offsetY = 0,
  } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 等待元素出现 */
    await page.waitForSelector(selector, { timeout: 10000 })

    /** 点击元素 */
    for (let i = 0; i < clickCount; i++) {
      await page.click(selector, {
        delay,
        offset: { x: offsetX, y: offsetY },
      })
    }

    return {
      content: [
        {
          type: 'text',
          text: `点击成功: ${selector}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `点击失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
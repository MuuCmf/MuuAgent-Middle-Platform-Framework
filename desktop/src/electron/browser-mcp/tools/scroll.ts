import { BrowserManager } from '../browser-manager'
import { ScrollArgs, BrowserToolResult } from '../types'

/**
 * 滚动工具处理器
 * @param args 滚动参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function scrollHandler(args: ScrollArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { direction, distance = 300, pageId = 'default', selector } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 滚动到指定元素 */
    if (selector) {
      await page.waitForSelector(selector, { timeout: 10000 })
      await page.evaluate((sel: string) => {
        const element = document.querySelector(sel)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, selector)
      return {
        content: [{ type: 'text', text: `滚动到元素成功: ${selector}` }],
      }
    }

    /** 根据方向滚动 */
    let scrollX = 0
    let scrollY = 0

    switch (direction) {
      case 'up':
        scrollY = -distance
        break
      case 'down':
        scrollY = distance
        break
      case 'left':
        scrollX = -distance
        break
      case 'right':
        scrollX = distance
        break
      case 'top':
        await page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
        return {
          content: [{ type: 'text', text: '滚动到顶部成功' }],
        }
      case 'bottom':
        await page.evaluate(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        })
        return {
          content: [{ type: 'text', text: '滚动到底部成功' }],
        }
      default:
        return {
          content: [{ type: 'text', text: `未知的滚动方向: ${direction}` }],
          isError: true,
        }
    }

    /** 执行滚动 */
    await page.evaluate((x: number, y: number) => {
      window.scrollBy({ left: x, top: y, behavior: 'smooth' })
    }, scrollX, scrollY)

    return {
      content: [{ type: 'text', text: `滚动成功: ${direction} ${distance}px` }],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `滚动失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
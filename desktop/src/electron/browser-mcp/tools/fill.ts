import { BrowserManager } from '../browser-manager'
import { FillArgs, BrowserToolResult } from '../types'

/**
 * 填充表单工具处理器
 * @param args 填充参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function fillHandler(args: FillArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const {
    selector,
    value,
    pageId = 'default',
    clear = true,
    delay = 0,
  } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 等待元素出现 */
    await page.waitForSelector(selector, { timeout: 10000 })

    /** 点击元素以聚焦 */
    await page.click(selector)

    /** 清空现有内容 */
    if (clear) {
      await page.evaluate((sel: string) => {
        const element = document.querySelector(sel) as HTMLInputElement
        if (element) {
          element.value = ''
        }
      }, selector)
    }

    /** 输入新内容 */
    await page.type(selector, value, { delay })

    return {
      content: [
        {
          type: 'text',
          text: `填充成功: ${selector} → "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `填充失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
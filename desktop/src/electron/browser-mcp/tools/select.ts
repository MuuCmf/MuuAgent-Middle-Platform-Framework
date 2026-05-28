import { BrowserManager } from '../browser-manager'
import { SelectArgs, BrowserToolResult } from '../types'

/**
 * 下拉选择工具处理器
 * @param args 选择参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function selectHandler(args: SelectArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { selector, value, pageId = 'default', selectBy = 'value' } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 等待下拉框出现 */
    await page.waitForSelector(selector, { timeout: 10000 })

    /** 根据选择方式执行不同操作 */
    switch (selectBy) {
      case 'value':
        await page.select(selector, value)
        break
      case 'text':
        /** 通过文本选择 */
        await page.evaluate((sel: string, text: string) => {
          const select = document.querySelector(sel) as HTMLSelectElement
          if (!select) return
          const options = Array.from(select.options)
          for (const option of options) {
            if (option.text === text) {
              select.value = option.value
              select.dispatchEvent(new Event('change', { bubbles: true }))
              break
            }
          }
        }, selector, value)
        break
      case 'index':
        /** 通过索引选择 */
        await page.evaluate((sel: string, index: string) => {
          const select = document.querySelector(sel) as HTMLSelectElement
          if (!select) return
          const idx = parseInt(index, 10)
          if (idx >= 0 && idx < select.options.length) {
            select.selectedIndex = idx
            select.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, selector, value)
        break
      default:
        return {
          content: [{ type: 'text', text: `未知的选择方式: ${selectBy}` }],
          isError: true,
        }
    }

    return {
      content: [
        {
          type: 'text',
          text: `选择成功: ${selector} → ${value} (${selectBy})`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `选择失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
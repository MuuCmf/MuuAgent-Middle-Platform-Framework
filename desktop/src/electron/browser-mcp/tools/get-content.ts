import { BrowserManager } from '../browser-manager'
import { GetContentArgs, BrowserToolResult } from '../types'

/**
 * 获取内容工具处理器
 * @param args 获取内容参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function getContentHandler(args: GetContentArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { contentType, selector, pageId = 'default', includeHidden = false } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 获取内容 */
    let content: string | null

    if (selector) {
      /** 等待元素出现 */
      await page.waitForSelector(selector, { timeout: 10000 })

      /** 获取特定元素的内容 */
      content = await page.evaluate((sel: string, type: string, hidden: boolean): string | null => {
        const element = document.querySelector(sel) as HTMLElement
        if (!element) return null

        if (!hidden && element.offsetParent === null) {
          return '元素不可见'
        }

        switch (type) {
          case 'text':
            return element.textContent || ''
          case 'html':
            return element.innerHTML
          case 'markdown':
            /** 简单的 Markdown 转换 */
            return element.textContent || ''
          case 'json':
            try {
              return JSON.stringify(JSON.parse(element.textContent || ''), null, 2)
            } catch {
              return element.textContent || ''
            }
          default:
            return element.textContent || ''
        }
      }, selector, contentType, includeHidden)

      if (content === null) {
        return {
          content: [{ type: 'text', text: `元素未找到: ${selector}` }],
          isError: true,
        }
      }
    } else {
      /** 获取整个页面的内容 */
      content = await page.evaluate((type: string): string => {
        switch (type) {
          case 'text':
            return document.body.textContent || ''
          case 'html':
            return document.body.innerHTML
          case 'markdown':
            /** 简单的 Markdown 转换 */
            return document.body.textContent || ''
          case 'json':
            try {
              return JSON.stringify(JSON.parse(document.body.textContent || ''), null, 2)
            } catch {
              return document.body.textContent || ''
            }
          default:
            return document.body.textContent || ''
        }
      }, contentType)
    }

    /** 截断过长的内容 */
    const maxLength = 10000
    const truncatedContent = content.length > maxLength
      ? content.substring(0, maxLength) + '\n...(内容过长，已截断)'
      : content

    return {
      content: [
        {
          type: 'text',
          text: `获取内容成功 (${contentType}):\n${truncatedContent}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `获取内容失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
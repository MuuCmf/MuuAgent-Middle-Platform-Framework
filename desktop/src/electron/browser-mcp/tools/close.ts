import { BrowserManager } from '../browser-manager'
import { CloseArgs, BrowserToolResult } from '../types'

/**
 * 关闭工具处理器
 * @param args 关闭参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function closeHandler(args: CloseArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { pageId, closeBrowser = false } = args

  try {
    if (closeBrowser) {
      /** 关闭整个浏览器 */
      await manager.closeBrowser()
      return {
        content: [
          {
            type: 'text',
            text: '浏览器已关闭',
          },
        ],
      }
    }

    if (pageId) {
      /** 关闭特定页面 */
      await manager.closePage(pageId)
      return {
        content: [
          {
            type: 'text',
            text: `页面已关闭: ${pageId}`,
          },
        ],
      }
    }

    /** 如果没有指定 pageId 且不关闭浏览器，关闭默认页面 */
    await manager.closePage('default')
    return {
      content: [
        {
          type: 'text',
          text: '默认页面已关闭',
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `关闭失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
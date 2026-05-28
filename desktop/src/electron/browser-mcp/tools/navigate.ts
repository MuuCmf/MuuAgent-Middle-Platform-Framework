import { BrowserManager } from '../browser-manager'
import { NavigateArgs, BrowserToolResult } from '../types'

/**
 * 导航工具处理器
 * @param args 导航参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function navigateHandler(args: NavigateArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { url, pageId = 'default', waitUntil = 'load', timeout = 30000 } = args

  try {
    /** 获取或创建页面 */
    const page = await manager.getPage(pageId)

    /** 导航到指定 URL */
    await page.goto(url, {
      waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2',
      timeout,
    })

    /** 获取页面信息 */
    const title = await page.title()
    const finalUrl = page.url()

    return {
      content: [
        {
          type: 'text',
          text: `导航成功\nURL: ${finalUrl}\n标题: ${title}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `导航失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
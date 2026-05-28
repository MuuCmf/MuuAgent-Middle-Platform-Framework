import { BrowserManager } from '../browser-manager'
import { BrowserScreenshotArgs, BrowserToolResult } from '../types'

/**
 * 截图工具处理器
 * @param args 截图参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function screenshotHandler(args: BrowserScreenshotArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const {
    pageId = 'default',
    format = 'png',
    quality = 80,
    maxWidth = 1280,
    fullPage = false,
    selector,
  } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 截图选项 */
    const screenshotOptions: any = {
      type: format,
      encoding: 'base64',
    }

    /** JPEG/WebP 格式需要设置质量 */
    if (format === 'jpeg' || format === 'webp') {
      screenshotOptions.quality = quality
    }

    /** 全页面截图 */
    if (fullPage) {
      screenshotOptions.fullPage = true
    }

    /** 截取特定元素 */
    if (selector) {
      const element = await page.$(selector)
      if (!element) {
        return {
          content: [{ type: 'text', text: `元素未找到: ${selector}` }],
          isError: true,
        }
      }
      const screenshot = await element.screenshot(screenshotOptions)
      return {
        content: [
          {
            type: 'image',
            data: screenshot.toString(),
            mimeType: `image/${format}`,
          },
        ],
      }
    }

    /** 截取整个页面 */
    const screenshot = await page.screenshot(screenshotOptions)
    const base64Data = screenshot.toString()

    /** 图片缩放（如果超过最大宽度） */
    let finalData = base64Data
    if (maxWidth && maxWidth < 1280) {
      /** 这里可以添加图片缩放逻辑，暂时直接返回原图 */
      finalData = base64Data
    }

    return {
      content: [
        {
          type: 'image',
          data: finalData,
          mimeType: `image/${format}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `截图失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
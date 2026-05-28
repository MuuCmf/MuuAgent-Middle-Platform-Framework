import { BrowserManager } from '../browser-manager'
import { WaitArgs, BrowserToolResult } from '../types'

/**
 * 等待工具处理器
 * @param args 等待参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function waitHandler(args: WaitArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const {
    type,
    target,
    timeout = 30000,
    pageId = 'default',
    waitUntil = 'load',
  } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 根据等待类型执行不同操作 */
    switch (type) {
      case 'selector':
        /** 等待元素出现 */
        if (!target) {
          return {
            content: [{ type: 'text', text: '等待类型为 selector 时，必须提供 target 参数' }],
            isError: true,
          }
        }
        await page.waitForSelector(target, { timeout })
        return {
          content: [{ type: 'text', text: `等待元素成功: ${target}` }],
        }

      case 'timeout':
        /** 等待指定时间 */
        await new Promise(resolve => setTimeout(resolve, timeout))
        return {
          content: [{ type: 'text', text: `等待时间成功: ${timeout}ms` }],
        }

      case 'function':
        /** 等待函数返回 true */
        if (!target) {
          return {
            content: [{ type: 'text', text: '等待类型为 function 时，必须提供 target 参数' }],
            isError: true,
          }
        }
        await page.waitForFunction(target, { timeout })
        return {
          content: [{ type: 'text', text: '等待函数成功' }],
        }

      case 'navigation':
        /** 等待页面导航完成 */
        await page.waitForNavigation({
          waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2',
          timeout,
        })
        return {
          content: [{ type: 'text', text: '等待导航成功' }],
        }

      default:
        return {
          content: [{ type: 'text', text: `未知的等待类型: ${type}` }],
          isError: true,
        }
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `等待失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
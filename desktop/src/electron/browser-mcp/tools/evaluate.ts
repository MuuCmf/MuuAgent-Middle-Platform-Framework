import { BrowserManager } from '../browser-manager'
import { EvaluateArgs, BrowserToolResult } from '../types'

/**
 * 执行脚本工具处理器
 * @param args 执行脚本参数
 * @param manager 浏览器实例管理器
 * @returns {Promise<BrowserToolResult>} 执行结果
 */
export async function evaluateHandler(args: EvaluateArgs, manager: BrowserManager): Promise<BrowserToolResult> {
  const { script, pageId = 'default', timeout = 30000 } = args

  try {
    /** 获取页面 */
    const page = await manager.getPage(pageId)

    /** 执行脚本 */
    const result = await page.evaluate(script, { timeout })

    /** 格式化结果 */
    let resultText: string
    if (result === undefined) {
      resultText = '脚本执行成功，无返回值'
    } else if (typeof result === 'object') {
      resultText = `脚本执行成功，返回值:\n${JSON.stringify(result, null, 2)}`
    } else {
      resultText = `脚本执行成功，返回值: ${result}`
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `脚本执行失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
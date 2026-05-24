import { clipboard } from 'electron'
import { ClipboardArgs, ToolResult } from '../types'

/**
 * 剪贴板操作工具处理器
 * 使用 Electron 原生 clipboard API 读取/写入剪贴板
 * @param args 剪贴板操作参数
 * @returns {Promise<ToolResult>} 执行结果
 */
export async function clipboardHandler(args: ClipboardArgs): Promise<ToolResult> {
  try {
    switch (args.action) {
      case 'read':
        return await handleRead()
      case 'write':
        return await handleWrite(args)
      default:
        return {
          content: [{ type: 'text', text: `不支持的剪贴板操作: ${args.action}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `剪贴板操作失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 读取剪贴板文本内容
 * @returns {Promise<ToolResult>}
 */
async function handleRead(): Promise<ToolResult> {
  const text = clipboard.readText()
  if (!text) {
    return { content: [{ type: 'text', text: '剪贴板为空。' }] }
  }
  return { content: [{ type: 'text', text: `剪贴板内容:\n${text}` }] }
}

/**
 * 写入文本到剪贴板
 * @param args 剪贴板参数（含 content）
 * @returns {Promise<ToolResult>}
 */
async function handleWrite(args: ClipboardArgs): Promise<ToolResult> {
  if (args.content === undefined) {
    return { content: [{ type: 'text', text: '写入剪贴板需要 content 参数' }], isError: true }
  }
  clipboard.writeText(args.content)
  return { content: [{ type: 'text', text: `已写入剪贴板: ${args.content.substring(0, 100)}${args.content.length > 100 ? '...' : ''}` }] }
}
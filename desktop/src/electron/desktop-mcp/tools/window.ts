import { screen as nutScreen } from '@nut-tree-fork/nut-js'
import { BrowserWindow, screen as electronScreen } from 'electron'
import { WindowArgs, ToolResult } from '../types'

/**
 * 窗口管理工具处理器
 * 使用 Electron API 和 nut.js 获取窗口信息
 * @param args 窗口操作参数
 * @returns {Promise<ToolResult>} 执行结果
 */
export async function windowHandler(args: WindowArgs): Promise<ToolResult> {
  try {
    switch (args.action) {
      case 'list':
        return await handleList(args)
      case 'active':
        return await handleActive()
      default:
        return {
          content: [{ type: 'text', text: `不支持的窗口操作: ${args.action}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `窗口操作失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 列出所有打开的窗口
 * @param args 窗口参数（含 title 过滤）
 * @returns {Promise<ToolResult>}
 */
async function handleList(args: WindowArgs): Promise<ToolResult> {
  const allWindows = BrowserWindow.getAllWindows()
  const activeWindows = allWindows.filter(w => !w.isDestroyed())

  if (activeWindows.length === 0) {
    return { content: [{ type: 'text', text: '当前没有打开的窗口。' }] }
  }

  const windowInfos = activeWindows.map((w, index) => {
    const title = w.getTitle()
    const bounds = w.getBounds()
    const isFocused = w.isFocused()
    const isVisible = w.isVisible()
    return { index, title, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, isFocused, isVisible }
  })

  /** 按 title 过滤 */
  const titleFilter = args.title?.toLowerCase()
  const filtered = titleFilter
    ? windowInfos.filter(w => w.title.toLowerCase().includes(titleFilter))
    : windowInfos

  if (filtered.length === 0) {
    return { content: [{ type: 'text', text: titleFilter ? `没有标题包含 "${args.title}" 的窗口。` : '没有可见窗口。' }] }
  }

  const text = filtered.map(w =>
    `[${w.index}]${w.isFocused ? ' [当前焦点]' : ''} "${w.title}" (${w.width}x${w.height} 位于 ${w.x},${w.y})${w.isVisible ? '' : ' [隐藏]'}`,
  ).join('\n')

  return { content: [{ type: 'text', text: `窗口列表:\n${text}` }] }
}

/**
 * 获取当前活动窗口信息
 * @returns {Promise<ToolResult>}
 */
async function handleActive(): Promise<ToolResult> {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  if (!focusedWindow || focusedWindow.isDestroyed()) {
    /** 返回显示器信息作为 fallback */
    const primaryDisplay = electronScreen.getPrimaryDisplay()
    const cursorPoint = electronScreen.getCursorScreenPoint()
    const info = `当前活动窗口: 无 Electron 窗口焦点\n主显示器: ${primaryDisplay.size.width}x${primaryDisplay.size.height}\n鼠标位置: (${cursorPoint.x}, ${cursorPoint.y})`
    return { content: [{ type: 'text', text: info }] }
  }

  const title = focusedWindow.getTitle()
  const bounds = focusedWindow.getBounds()
  const info = `当前活动窗口:\n标题: "${title}"\n分辨率: ${bounds.width}x${bounds.height}\n位置: (${bounds.x}, ${bounds.y})`

  return { content: [{ type: 'text', text: info }] }
}
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { KeyboardArgs, ToolResult } from '../types'

/**
 * 键盘操作工具处理器
 * 使用 nut.js 执行键盘操作（输入文本、按键、组合键）
 * @param args 键盘操作参数
 * @returns {Promise<ToolResult>} 执行结果
 */
export async function keyboardHandler(args: KeyboardArgs): Promise<ToolResult> {
  try {
    switch (args.action) {
      case 'type':
        return await handleType(args)
      case 'press':
        return await handlePress(args)
      case 'shortcut':
        return await handleShortcut(args)
      default:
        return {
          content: [{ type: 'text', text: `不支持的键盘操作: ${args.action}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `键盘操作失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 输入文本
 * @param args 键盘参数（含 text）
 * @returns {Promise<ToolResult>}
 */
async function handleType(args: KeyboardArgs): Promise<ToolResult> {
  if (!args.text) {
    return { content: [{ type: 'text', text: '输入文本需要 text 参数' }], isError: true }
  }
  await keyboard.type(args.text)
  return { content: [{ type: 'text', text: `已输入文本: ${args.text}` }] }
}

/**
 * 单个按键
 * @param args 键盘参数（含 keys）
 * @returns {Promise<ToolResult>}
 */
async function handlePress(args: KeyboardArgs): Promise<ToolResult> {
  if (!args.keys || args.keys.length === 0) {
    return { content: [{ type: 'text', text: '按键需要 keys 参数' }], isError: true }
  }
  for (const keyName of args.keys) {
    const key = mapKey(keyName)
    if (key) {
      await keyboard.pressKey(key)
      await keyboard.releaseKey(key)
    } else {
      console.warn(`[Keyboard] 不支持的按键: ${keyName}`)
    }
  }
  return { content: [{ type: 'text', text: `已按下按键: ${args.keys.join(', ')}` }] }
}

/**
 * 组合键
 * @param args 键盘参数（含 keys）
 * @returns {Promise<ToolResult>}
 */
async function handleShortcut(args: KeyboardArgs): Promise<ToolResult> {
  if (!args.keys || args.keys.length === 0) {
    return { content: [{ type: 'text', text: '组合键需要 keys 参数' }], isError: true }
  }
  const mappedKeys = args.keys.map(mapKey).filter((k): k is Key => k !== null)
  if (mappedKeys.length === 0) {
    return { content: [{ type: 'text', text: `不支持的按键组合: ${args.keys.join(', ')}` }], isError: true }
  }
  await keyboard.pressKey(...mappedKeys)
  await keyboard.releaseKey(...mappedKeys)
  return { content: [{ type: 'text', text: `已按下组合键: ${args.keys.join(' + ')}` }] }
}

/**
 * 将按键名称映射为 nut.js Key 枚举
 * @param keyName 按键名称
 * @returns {Key | null} 对应的 Key 枚举值
 */
function mapKey(keyName: string): Key | null {
  const keyMap: Record<string, Key> = {
    'Control': Key.LeftControl,
    'Ctrl': Key.LeftControl,
    'Alt': Key.LeftAlt,
    'Shift': Key.LeftShift,
    'Meta': Key.LeftSuper,
    'Cmd': Key.LeftSuper,
    'Win': Key.LeftSuper,
    'Enter': Key.Enter,
    'Tab': Key.Tab,
    'Escape': Key.Escape,
    'Esc': Key.Escape,
    'Backspace': Key.Backspace,
    'Delete': Key.Delete,
    'Home': Key.Home,
    'End': Key.End,
    'PageUp': Key.PageUp,
    'PageDown': Key.PageDown,
    'Space': Key.Space,
    'ArrowUp': Key.Up,
    'Up': Key.Up,
    'ArrowDown': Key.Down,
    'Down': Key.Down,
    'ArrowLeft': Key.Left,
    'Left': Key.Left,
    'ArrowRight': Key.Right,
    'Right': Key.Right,
    'F1': Key.F1,
    'F2': Key.F2,
    'F3': Key.F3,
    'F4': Key.F4,
    'F5': Key.F5,
    'F6': Key.F6,
    'F7': Key.F7,
    'F8': Key.F8,
    'F9': Key.F9,
    'F10': Key.F10,
    'F11': Key.F11,
    'F12': Key.F12,
    'Insert': Key.Insert,
    'Print': Key.Print,
  }

  /** 先查找映射表 */
  if (keyMap[keyName]) {
    return keyMap[keyName]
  }

  /** 尝试匹配单字母/数字键 */
  if (keyName.length === 1) {
    const upper = keyName.toUpperCase()
    const keyFromChar = (Key as Record<string, unknown>)[upper]
    if (keyFromChar !== undefined && typeof keyFromChar === 'number') {
      return keyFromChar as unknown as Key
    }
  }

  /** 尝试匹配 'Key_A' 格式 */
  const prefixed = (Key as Record<string, unknown>)[`Key${keyName.charAt(0).toUpperCase() + keyName.slice(1)}`]
  if (prefixed !== undefined && typeof prefixed === 'number') {
    return prefixed as unknown as Key
  }

  return null
}
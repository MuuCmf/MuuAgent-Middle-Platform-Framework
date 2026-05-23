import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as os from 'os'
import { SystemControlTools } from '../tools/system-control'
import { checkCommandSafety } from '../tools/command-sandbox'
import { toolScheduler } from '../tools/tool-scheduler'

/** 系统控制工具实例 */
const tools = new SystemControlTools()

/** 高危操作工具列表，需要用户确认 */
const CONFIRM_REQUIRED_TOOLS = [
  'launch_application',
  'close_application',
  'write_clipboard',
  'open_file',
  'switch_to_window',
  'execute_command',
  'shutdown',
  'sleep',
]

/**
 * 注册系统控制 IPC 处理器
 * 渲染进程通过 ipcRenderer.invoke('system-control:execute', ...) 调用
 */
export function registerSystemControlIpc(): void {
  ipcMain.handle('system-control:execute', async (event, payload: {
    /** 工具名称 */
    toolName: string;
    /** 工具参数 */
    args: Record<string, unknown>;
  }) => {
    const { toolName, args } = payload

    /** 命令执行安全检查 */
    if (toolName === 'execute_command') {
      const command = args.command as string
      const safety = checkCommandSafety(command)

      if (safety === 'blocked') {
        return { success: false, error: `命令被安全策略拦截: ${command}` }
      }

      if (safety === 'needsConfirm') {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win) {
          const result = await dialog.showMessageBox(win, {
            type: 'warning',
            title: '命令执行确认',
            message: `即将执行以下命令：`,
            detail: command,
            buttons: ['取消', '确认执行'],
            defaultId: 0,
            cancelId: 0,
          })
          if (result.response !== 1) {
            return { success: false, error: '用户取消了命令执行' }
          }
        }
      }
    }

    /** 高危操作确认弹窗 */
    if (CONFIRM_REQUIRED_TOOLS.includes(toolName) && toolName !== 'execute_command') {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        const result = await dialog.showMessageBox(win, {
          type: 'question',
          title: '操作确认',
          message: `即将执行: ${toolName}`,
          detail: `参数: ${JSON.stringify(args)}`,
          buttons: ['取消', '确认'],
          defaultId: 0,
          cancelId: 0,
        })
        if (result.response !== 1) {
          return { success: false, error: '用户取消了操作' }
        }
      }
    }

    /** 通过调度器执行工具（处理并发控制） */
    return toolScheduler.schedule(toolName, toolName, args, () =>
      executeTool(toolName, args),
    )
  })

  /** 获取系统信息 */
  ipcMain.handle('system:info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      username: os.userInfo().username,
    }
  })
}

/**
 * 执行具体工具
 * @param toolName 工具名称
 * @param args 工具参数
 * @returns {Promise<{success: boolean; result?: unknown; error?: string}>} 执行结果
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    let result: unknown

    switch (toolName) {
      case 'launch_application':
        result = await tools.launchApplication(args.name as string)
        break
      case 'close_application':
        result = await tools.closeApplication(args.name as string)
        break
      case 'list_processes':
        result = await tools.listProcesses()
        break
      case 'take_screenshot':
        result = await tools.takeScreenshot()
        break
      case 'set_volume':
        result = await tools.setVolume(args.level as number)
        break
      case 'get_volume':
        result = await tools.getVolume()
        break
      case 'read_clipboard':
        result = await tools.readClipboard()
        break
      case 'write_clipboard':
        result = await tools.writeClipboard(args.text as string)
        break
      case 'search_files':
        result = await tools.searchFiles(args.query as string, args.basePath as string | undefined)
        break
      case 'open_file':
        result = await tools.openFile(args.path as string)
        break
      case 'list_open_windows':
        result = await tools.listOpenWindows()
        break
      case 'switch_to_window':
        result = await tools.switchToWindow(args.title as string)
        break
      case 'show_notification':
        result = await tools.showNotification(args.title as string, args.body as string)
        break
      case 'execute_command':
        result = await tools.executeCommand(args.command as string, args.timeout as number | undefined)
        break
      case 'shutdown':
        result = await tools.shutdown()
        break
      case 'sleep':
        result = await tools.sleep()
        break
      default:
        return { success: false, error: `未知的系统控制工具: ${toolName}` }
    }

    return { success: true, result }
  } catch (e: any) {
    return { success: false, error: e.message || '执行失败' }
  }
}

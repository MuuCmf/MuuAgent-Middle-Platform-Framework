import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import * as path from 'path'
import { getConfigValue } from './config/store'
import { DesktopMcpModule } from './desktop-mcp'

/** 修复 Windows 下 GPU 缓存权限问题 */
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'cache'))

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null

/** 是否为开发环境（process.defaultApp 在 electron . 启动时为 true） */
const isDev = !app.isPackaged || !!process.defaultApp

/** Desktop MCP 模块实例 */
let desktopMcpModule: DesktopMcpModule | null = null

/**
 * 创建主窗口
 * @returns {BrowserWindow} 主窗口实例
 */
function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MuuAgent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174/client/')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../client/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/**
 * 注册全局快捷键
 * Ctrl+Shift+Space 唤醒语音输入
 */
function registerGlobalShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      mainWindow.webContents.send('voice:start-recording')
    }
  })
}

/**
 * 注册 IPC 处理器
 */
function registerIpcHandlers(): void {
  /** 桌面自动化确认弹窗回传 */
  ipcMain.on('automation:confirm:response', (_event, data: { channel: string; confirmed: boolean }) => {
    mainWindow?.webContents.send(data.channel, data.confirmed)
  })

  /** 桌面自动化工具执行（来自浏览器渲染进程的 IPC 调用） */
  ipcMain.handle('desktop:execute-tool', async (
    _event,
    payload: { callId: string; toolName: string; args: Record<string, unknown> },
  ): Promise<{ callId: string; success: boolean; result?: unknown; error?: string }> => {
    const { callId, toolName, args } = payload

    try {
      const server = desktopMcpModule?.getBridge()?.getServer()
      if (!server) {
        return { callId, success: false, error: '桌面自动化模块未初始化' }
      }

      console.log(`[Main] 收到桌面工具调用: ${toolName}, callId: ${callId}`)

      /** 浏览器端已通过 clientToolRouter 完成确认，此处跳过二次确认 */
      const result = await server.callTool(toolName, args, { skipConfirm: true })

      return {
        callId,
        success: !result.isError,
        result: result.content,
        error: result.isError ? (result.content[0]?.text || '执行失败') : undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Main] 桌面工具执行异常: ${toolName}, ${message}`)
      return { callId, success: false, error: message }
    }
  })
}

/**
 * 启动桌面自动化模块
 */
function startDesktopAutomation(): void {
  const automation = getConfigValue('automation')

  desktopMcpModule = new DesktopMcpModule()
  desktopMcpModule.start(automation, mainWindow)
    .then((bridge) => {
      console.log('[Main] 桌面自动化模块已启动，Bridge 就绪')
    })
    .catch((err) => {
      console.error('[Main] 桌面自动化模块启动失败:', err)
    })
}

app.whenReady().then(() => {
  const win = createMainWindow()

  registerGlobalShortcuts()
  registerIpcHandlers()

  /** 启动桌面自动化 */
  startDesktopAutomation()

  if (!isDev) {
    import('./updater').then(({ initAutoUpdater }) => {
      initAutoUpdater(win)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()

  /** 停止桌面自动化模块 */
  if (desktopMcpModule) {
    desktopMcpModule.stop()
  }
})

export { mainWindow }
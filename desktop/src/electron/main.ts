import { app, BrowserWindow, globalShortcut, ipcMain, shell, session, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { getConfigValue } from './config/store'
import { DesktopMcpModule } from './desktop-mcp'

/** 文件树节点类型 */
interface FileTreeNode {
  name: string
  kind: 'file' | 'directory'
  children?: FileTreeNode[]
  extension?: string
  relativePath: string
}

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

  /** 打开本地文件或目录（使用系统默认应用） */
  ipcMain.handle('shell:open-path', async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Main] 打开文件失败: ${filePath}, ${message}`)
      return { success: false, error: message }
    }
  })

  /** 选择工作目录（返回完整路径） */
  ipcMain.handle('dialog:select-directory', async (): Promise<{ path: string; name: string } | null> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择工作目录',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const dirPath = result.filePaths[0]
    const dirName = path.basename(dirPath)

    return { path: dirPath, name: dirName }
  })

  /** 读取目录结构（返回文件树） */
  ipcMain.handle('fs:read-dir-tree', async (_event, dirPath: string): Promise<FileTreeNode[]> => {
    async function buildTree(currentPath: string, prefix: string): Promise<FileTreeNode[]> {
      const nodes: FileTreeNode[] = []
      
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        
        // 排序：目录优先，然后按名称排序
        entries.sort((a: fs.Dirent, b: fs.Dirent) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
        
        for (const entry of entries) {
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
          
          const node: FileTreeNode = {
            name: entry.name,
            kind: entry.isDirectory() ? 'directory' : 'file',
            relativePath,
          }
          
          if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && ext !== entry.name.toLowerCase()) {
              node.extension = ext
            }
          } else if (entry.isDirectory()) {
            node.children = await buildTree(path.join(currentPath, entry.name), relativePath)
          }
          
          nodes.push(node)
        }
      } catch (err) {
        console.error(`[Main] 读取目录失败: ${currentPath}`, err)
      }
      
      return nodes
    }
    
    return buildTree(dirPath, '')
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
  /** 设置 Content Security Policy */
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5174; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5174 ws://localhost:5174 http://localhost:9898; img-src 'self' data: https:; font-src 'self' data:"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; font-src 'self' data:"
  
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

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
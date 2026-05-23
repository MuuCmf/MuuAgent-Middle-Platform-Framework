import { app, BrowserWindow, globalShortcut } from 'electron'
import * as path from 'path'

/** 修复 Windows 下 GPU 缓存权限问题 */
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'cache'))

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null

/** 是否为开发环境（process.defaultApp 在 electron . 启动时为 true） */
const isDev = !app.isPackaged || !!process.defaultApp

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

app.whenReady().then(() => {
  const win = createMainWindow()

  registerGlobalShortcuts()

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
})

export { mainWindow }

import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'

/**
 * 初始化自动更新
 * @param mainWindow 主窗口实例
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  /** 开发环境下跳过更新检查 */
  if (!app.isPackaged) return

  /** 配置更新源 */
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  /** 检测到新版本 */
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  })

  /** 下载进度 */
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:progress', {
      percent: progress.percent,
      speed: progress.bytesPerSecond,
    })
  })

  /** 下载完成，提示安装 */
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded')
  })

  /** 错误处理 */
  autoUpdater.on('error', (error) => {
    console.error('[Updater] 自动更新错误:', error)
  })

  /** 启动时检查更新 */
  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[Updater] 检查更新失败:', err.message)
  })
}

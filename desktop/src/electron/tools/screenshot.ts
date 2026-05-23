import { BrowserWindow, desktopCapturer, nativeImage } from 'electron'

/**
 * 截取当前屏幕画面
 * @returns {Promise<Electron.NativeImage>} 截图图像
 */
export async function screenshot(): Promise<Electron.NativeImage> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  })

  if (sources.length === 0) {
    throw new Error('未找到可截取的屏幕')
  }

  const primarySource = sources[0]
  return primarySource.thumbnail
}

import { desktopCapturer, screen } from 'electron'
import { ScreenshotArgs, ToolResult } from '../types'

/**
 * 截图工具处理器
 * 使用 Electron 内置 desktopCapturer API 截取屏幕
 * @param args 截图参数
 * @returns {Promise<ToolResult>} 包含 Base64 图片和坐标映射元数据的结果
 */
export async function screenshotHandler(args: ScreenshotArgs): Promise<ToolResult> {
  const format: 'png' | 'jpg' = args.format || 'png'
  const maxWidth: number = args.maxWidth || 1280

  try {
    /** 获取所有显示器信息 */
    const displays = screen.getAllDisplays()

    /** 确定目标显示器 */
    let targetDisplay: Electron.Display
    if (args.screen !== undefined && args.screen < displays.length) {
      targetDisplay = displays[args.screen]
    } else {
      targetDisplay = screen.getPrimaryDisplay()
    }

    const actualWidth: number = targetDisplay.bounds.width
    const actualHeight: number = targetDisplay.bounds.height

    /** 确定要截取的源 */
    const thumbnailSize = determineThumbnailSize(displays, args.screen, maxWidth)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize,
    })

    let targetSource: Electron.DesktopCapturerSource | undefined

    if (args.screen !== undefined && args.screen < sources.length) {
      targetSource = sources[args.screen]
    } else {
      /** 默认使用第一个屏幕源（通常是主显示器） */
      targetSource = sources[0]
    }

    if (!targetSource) {
      return {
        content: [{ type: 'text', text: '错误：未找到屏幕源' }],
        isError: true,
      }
    }

    const thumbnail = targetSource.thumbnail
    const thumbWidth: number = thumbnail.getSize().width
    const thumbHeight: number = thumbnail.getSize().height
    let imageData: Buffer

    if (format === 'jpg') {
      imageData = thumbnail.toJPEG(80)
    } else {
      imageData = thumbnail.toPNG()
    }

    const base64Data = imageData.toString('base64')
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'

    /** 返回实际分辨率和缩略图分辨率，供鼠标坐标映射使用 */
    const scaleX = actualWidth / thumbWidth
    const scaleY = actualHeight / thumbHeight

    return {
      content: [
        {
          type: 'text',
          text: `截图完成。实际屏幕分辨率: ${actualWidth}x${actualHeight}，` +
            `截图分辨率: ${thumbWidth}x${thumbHeight}，` +
            `坐标缩放比例: x${scaleX.toFixed(4)} / y${scaleY.toFixed(4)}，` +
            `格式: ${format}，图片数据见下方。\n` +
            `【鼠标操作提示】进行鼠标操作时，请根据截图坐标乘以缩放比例换算为实际坐标，` +
            `或传入 screenWidth=${actualWidth}&screenHeight=${actualHeight} 自动换算。`,
        },
        {
          type: 'image',
          data: base64Data,
          mimeType,
        },
      ],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `截图失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 根据目标宽度计算缩略图尺寸，保持宽高比
 * @param displays 显示器列表
 * @param targetScreen 目标显示器索引
 * @param maxWidth 最大宽度
 * @returns {{ width: number; height: number }} 缩略图尺寸
 */
function determineThumbnailSize(
  displays: Electron.Display[],
  targetScreen: number | undefined,
  maxWidth: number,
): { width: number; height: number } {
  let display: Electron.Display

  if (targetScreen !== undefined && targetScreen < displays.length) {
    display = displays[targetScreen]
  } else {
    display = screen.getPrimaryDisplay()
  }

  const { width, height } = display.bounds
  const scale = Math.min(1, maxWidth / width)

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}
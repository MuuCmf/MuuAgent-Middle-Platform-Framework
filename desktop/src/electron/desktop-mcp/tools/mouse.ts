import { mouse, Point, Button, screen as nutScreen } from '@nut-tree-fork/nut-js'
import { screen } from 'electron'
import { MouseArgs, ToolResult } from '../types'

/** 延时辅助函数 */
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * 鼠标操作工具处理器
 * 使用 nut.js 执行鼠标操作（点击、移动、拖拽、滚动）
 * @param args 鼠标操作参数（含 screenWidth/screenHeight 用于坐标映射）
 * @returns {Promise<ToolResult>} 执行结果
 */
export async function mouseHandler(args: MouseArgs): Promise<ToolResult> {
  /** 计算坐标缩放因子 */
  const scale = getScaleFactor(args)
  try {
    switch (args.action) {
      case 'left_click':
        return await handleLeftClick(args, scale)
      case 'right_click':
        return await handleRightClick(args, scale)
      case 'double_click':
        return await handleDoubleClick(args, scale)
      case 'move':
        return await handleMove(args, scale)
      case 'drag':
        return await handleDrag(args, scale)
      case 'scroll':
        return await handleScroll(args)
      case 'position':
        return await handlePosition()
      default:
        return {
          content: [{ type: 'text', text: `不支持的鼠标操作: ${args.action}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `鼠标操作失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 获取坐标缩放因子
 * @param args 鼠标参数
 * @returns {number} 缩放比例（实际屏幕 / 截图分辨率）
 */
function getScaleFactor(args: MouseArgs): number {
  if (!args.screenWidth || !args.screenHeight) return 1
  /** 使用 Electron screen API 获取实际屏幕尺寸 */
  const primaryDisplay = screen.getPrimaryDisplay()
  const actualWidth = primaryDisplay.bounds.width
  return actualWidth / args.screenWidth
}

/**
 * 左键点击
 * @param args 鼠标参数（含坐标）
 * @param scale 坐标缩放比例
 * @returns {Promise<ToolResult>}
 */
async function handleLeftClick(args: MouseArgs, scale: number): Promise<ToolResult> {
  if (args.x === undefined || args.y === undefined) {
    return { content: [{ type: 'text', text: '左键点击需要 x、y 坐标参数' }], isError: true }
  }
  await mouse.setPosition(scalePoint(args.x, args.y, scale))
  await sleep(100)
  await mouse.click(Button.LEFT)
  const pos = await mouse.getPosition()
  return { content: [{ type: 'text', text: `左键点击完成: 截图坐标(${args.x}, ${args.y}) → 实际坐标(${pos.x}, ${pos.y})` }] }
}

/**
 * 右键点击
 * @param args 鼠标参数（含坐标）
 * @param scale 坐标缩放比例
 * @returns {Promise<ToolResult>}
 */
async function handleRightClick(args: MouseArgs, scale: number): Promise<ToolResult> {
  if (args.x === undefined || args.y === undefined) {
    return { content: [{ type: 'text', text: '右键点击需要 x、y 坐标参数' }], isError: true }
  }
  await mouse.setPosition(scalePoint(args.x, args.y, scale))
  await sleep(100)
  await mouse.click(Button.RIGHT)
  const pos = await mouse.getPosition()
  return { content: [{ type: 'text', text: `右键点击完成: 截图坐标(${args.x}, ${args.y}) → 实际坐标(${pos.x}, ${pos.y})` }] }
}

/**
 * 双击
 * @param args 鼠标参数（含坐标）
 * @param scale 坐标缩放比例
 * @returns {Promise<ToolResult>}
 */
async function handleDoubleClick(args: MouseArgs, scale: number): Promise<ToolResult> {
  if (args.x === undefined || args.y === undefined) {
    return { content: [{ type: 'text', text: '双击需要 x、y 坐标参数' }], isError: true }
  }
  await mouse.setPosition(scalePoint(args.x, args.y, scale))
  await sleep(100)
  await mouse.doubleClick(Button.LEFT)
  const pos = await mouse.getPosition()
  return { content: [{ type: 'text', text: `双击完成: 截图坐标(${args.x}, ${args.y}) → 实际坐标(${pos.x}, ${pos.y})` }] }
}

/**
 * 移动鼠标
 * @param args 鼠标参数（含目标坐标）
 * @param scale 坐标缩放比例
 * @returns {Promise<ToolResult>}
 */
async function handleMove(args: MouseArgs, scale: number): Promise<ToolResult> {
  if (args.x === undefined || args.y === undefined) {
    return { content: [{ type: 'text', text: '移动鼠标需要 x、y 坐标参数' }], isError: true }
  }
  await mouse.setPosition(scalePoint(args.x, args.y, scale))
  const pos = await mouse.getPosition()
  return { content: [{ type: 'text', text: `鼠标已移动: 截图坐标(${args.x}, ${args.y}) → 实际坐标(${pos.x}, ${pos.y})` }] }
}

/**
 * 拖拽
 * @param args 鼠标参数（含起点和终点坐标）
 * @param scale 坐标缩放比例
 * @returns {Promise<ToolResult>}
 */
async function handleDrag(args: MouseArgs, scale: number): Promise<ToolResult> {
  if (args.x === undefined || args.y === undefined) {
    return { content: [{ type: 'text', text: '拖拽需要 x、y 起点坐标参数' }], isError: true }
  }
  if (args.endX === undefined || args.endY === undefined) {
    return { content: [{ type: 'text', text: '拖拽需要 endX、endY 终点坐标参数' }], isError: true }
  }
  const startPoint = scalePoint(args.x, args.y, scale)
  const endPoint = scalePoint(args.endX, args.endY, scale)
  await mouse.setPosition(startPoint)
  await sleep(100)
  await mouse.pressButton(Button.LEFT)
  await sleep(50)
  await mouse.move(straightTo(endPoint))
  await sleep(50)
  await mouse.releaseButton(Button.LEFT)
  return { content: [{ type: 'text', text: `拖拽完成: 截图(${args.x},${args.y})→(${args.endX},${args.endY}) 实际(${startPoint.x},${startPoint.y})→(${endPoint.x},${endPoint.y})` }] }
}

/**
 * 滚动
 * @param args 鼠标参数（含滚动量）
 * @returns {Promise<ToolResult>}
 */
async function handleScroll(args: MouseArgs): Promise<ToolResult> {
  const sx = args.scrollX || 0
  const sy = args.scrollY || 0
  await mouse.scrollDown(Math.abs(sy > 0 ? sy : 0))
  await mouse.scrollUp(Math.abs(sy < 0 ? -sy : 0))
  await mouse.scrollRight(Math.abs(sx > 0 ? sx : 0))
  await mouse.scrollLeft(Math.abs(sx < 0 ? -sx : 0))
  return { content: [{ type: 'text', text: `滚动完成: (scrollX: ${sx}, scrollY: ${sy})` }] }
}

/**
 * 获取当前鼠标位置
 * @returns {Promise<ToolResult>}
 */
async function handlePosition(): Promise<ToolResult> {
  const pos = await mouse.getPosition()
  return { content: [{ type: 'text', text: `当前鼠标位置: (${pos.x}, ${pos.y})` }] }
}

/**
 * 将截图坐标系坐标映射到实际屏幕坐标
 * @param x 截图坐标系 X
 * @param y 截图坐标系 Y
 * @param scale 缩放比例（实际屏幕宽度 / 截图宽度）
 * @returns {Point} 实际屏幕坐标
 */
function scalePoint(x: number, y: number, scale: number): Point {
  if (scale === 1) return { x: Math.round(x), y: Math.round(y) }
  return { x: Math.round(x * scale), y: Math.round(y * scale) }
}

/**
 * 生成从当前位置到目标位置的直线移动路径
 * @param target 目标坐标
 * @returns {Promise<Point[]>} 移动路径
 */
async function straightTo(target: Point): Promise<Point[]> {
  const current = await mouse.getPosition()
  const steps = 20
  const result: Point[] = []
  for (let i = 1; i <= steps; i++) {
    result.push({
      x: current.x + Math.round((target.x - current.x) * (i / steps)),
      y: current.y + Math.round((target.y - current.y) * (i / steps)),
    })
  }
  return result
}
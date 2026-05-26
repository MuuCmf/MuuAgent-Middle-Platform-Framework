import { ref } from 'vue'

/**
 * 事件类型定义
 */
export type EventType = 'show-api-key-dialog'

/**
 * 事件回调类型
 */
type EventCallback = () => void

/**
 * 事件监听器映射
 */
const listeners = new Map<EventType, Set<EventCallback>>()

/**
 * 订阅事件
 * @param event 事件名称
 * @param callback 回调函数
 * @returns 取消订阅函数
 */
export function subscribe(event: EventType, callback: EventCallback): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(callback)

  return () => {
    listeners.get(event)?.delete(callback)
  }
}

/**
 * 发布事件
 * @param event 事件名称
 */
export function publish(event: EventType): void {
  listeners.get(event)?.forEach(callback => callback())
}

/**
 * API Key 弹窗状态管理
 */
export const apiKeyDialogState = {
  /** 弹窗引用 */
  dialogRef: ref<{ open: (onConfirm?: () => void) => void } | null>(null),

  /** 弹窗是否正在显示 */
  isShowing: false,

  /**
   * 设置弹窗引用
   * @param ref 弹窗组件引用
   */
  setRef(ref: { open: (onConfirm?: () => void) => void } | null): void {
    this.dialogRef.value = ref
  },

  /**
   * 打开弹窗（防重复）
   * @param onConfirm 确认回调
   */
  open(onConfirm?: () => void): void {
    /** 如果弹窗已经打开，不再重复触发 */
    if (this.isShowing) {
      return
    }

    this.isShowing = true
    this.dialogRef.value?.open(onConfirm)
  },

  /**
   * 关闭弹窗后重置状态
   */
  close(): void {
    this.isShowing = false
  },
}
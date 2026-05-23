/**
 * SSE 断线重连管理器
 * 使用指数退避策略进行重连
 */
export class SseReconnectManager {
  /** 重连次数 */
  private retryCount = 0
  /** 最大重连次数 */
  private maxRetries = 5
  /** 基础重连间隔（ms） */
  private baseInterval = 1000
  /** 重连定时器 */
  private retryTimer: NodeJS.Timeout | null = null

  /**
   * 计算指数退避重连间隔
   * @returns {number} 重连间隔（ms）
   */
  private getRetryInterval(): number {
    return Math.min(this.baseInterval * Math.pow(2, this.retryCount), 30000)
  }

  /**
   * SSE 断开时触发重连
   * @param reconnectFn 重连函数
   */
  async onDisconnect(reconnectFn: () => Promise<void>): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      console.error('[SSE] 达到最大重连次数，停止重连')
      return
    }

    const interval = this.getRetryInterval()
    console.log(`[SSE] 将在 ${interval}ms 后重连（第 ${this.retryCount + 1} 次）`)

    this.retryTimer = setTimeout(async () => {
      this.retryCount++
      try {
        await reconnectFn()
        this.retryCount = 0
      } catch {
        await this.onDisconnect(reconnectFn)
      }
    }, interval)
  }

  /** 连接恢复后重置计数 */
  onConnected(): void {
    this.retryCount = 0
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  /** 是否正在重连中 */
  isReconnecting(): boolean {
    return this.retryCount > 0
  }
}

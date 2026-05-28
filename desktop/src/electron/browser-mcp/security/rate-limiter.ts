/**
 * 频率限制器
 * 用于限制浏览器自动化操作的频率
 */
export class RateLimiter {
  /** 每分钟允许的最大操作次数 */
  private maxOperationsPerMinute: number
  /** 操作时间戳记录 */
  private operationTimestamps: number[] = []
  /** 时间窗口大小（毫秒） */
  private windowSizeMs = 60000

  /**
   * @param maxOperationsPerMinute 每分钟允许的最大操作次数，0 表示不限制
   */
  constructor(maxOperationsPerMinute: number = 0) {
    this.maxOperationsPerMinute = maxOperationsPerMinute
  }

  /**
   * 尝试获取操作许可
   * @returns {boolean} 是否允许操作
   */
  tryAcquire(): boolean {
    /** 如果限制为 0，不限制 */
    if (this.maxOperationsPerMinute === 0) {
      return true
    }

    const now = Date.now()

    /** 清理过期的时间戳 */
    this.operationTimestamps = this.operationTimestamps.filter(
      timestamp => now - timestamp < this.windowSizeMs
    )

    /** 检查是否超过限制 */
    if (this.operationTimestamps.length >= this.maxOperationsPerMinute) {
      return false
    }

    /** 记录本次操作时间戳 */
    this.operationTimestamps.push(now)
    return true
  }

  /**
   * 更新频率限制
   * @param maxOperationsPerMinute 新的限制值
   */
  updateLimit(maxOperationsPerMinute: number): void {
    this.maxOperationsPerMinute = maxOperationsPerMinute
  }

  /**
   * 获取当前限制值
   * @returns {number} 每分钟允许的最大操作次数
   */
  getLimit(): number {
    return this.maxOperationsPerMinute
  }

  /**
   * 获取当前窗口内的操作次数
   * @returns {number} 操作次数
   */
  getCurrentCount(): number {
    const now = Date.now()
    this.operationTimestamps = this.operationTimestamps.filter(
      timestamp => now - timestamp < this.windowSizeMs
    )
    return this.operationTimestamps.length
  }

  /**
   * 获取剩余可用次数
   * @returns {number} 剩余次数
   */
  getRemainingCount(): number {
    if (this.maxOperationsPerMinute === 0) {
      return Infinity
    }
    return Math.max(0, this.maxOperationsPerMinute - this.getCurrentCount())
  }

  /**
   * 获取下次可用时间（毫秒）
   * @returns {number} 需要等待的时间，0 表示立即可用
   */
  getNextAvailableTime(): number {
    if (this.tryAcquire()) {
      return 0
    }

    if (this.operationTimestamps.length === 0) {
      return 0
    }

    /** 计算最早过期的时间戳 */
    const oldestTimestamp = this.operationTimestamps[0]
    const expiryTime = oldestTimestamp + this.windowSizeMs
    return Math.max(0, expiryTime - Date.now())
  }

  /**
   * 重置限制器
   */
  reset(): void {
    this.operationTimestamps = []
  }
}
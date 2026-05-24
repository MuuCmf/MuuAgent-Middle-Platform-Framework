/**
 * 操作频率限制器
 * 基于滑动窗口算法，限制每分钟操作次数
 */
export class RateLimiter {
  /** 时间窗口内的操作记录 */
  private records: number[] = []
  /** 每分钟最大操作次数 */
  private maxPerMinute: number

  /**
   * @param maxPerMinute 每分钟最大操作次数，0 表示不限制
   */
  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute
  }

  /**
   * 尝试执行一次操作
   * @returns {boolean} 是否允许执行
   */
  tryAcquire(): boolean {
    if (this.maxPerMinute <= 0) {
      return true
    }

    const now = Date.now()
    const windowStart = now - 60000

    /** 清理窗口外的记录 */
    this.records = this.records.filter(t => t > windowStart)

    if (this.records.length >= this.maxPerMinute) {
      return false
    }

    this.records.push(now)
    return true
  }

  /**
   * 更新限制值
   * @param maxPerMinute 新的限制值
   */
  updateLimit(maxPerMinute: number): void {
    this.maxPerMinute = maxPerMinute
  }

  /**
   * 获取当前窗口内的剩余可用次数
   * @returns {number} 剩余次数
   */
  getRemaining(): number {
    if (this.maxPerMinute <= 0) {
      return Infinity
    }
    const now = Date.now()
    const windowStart = now - 60000
    this.records = this.records.filter(t => t > windowStart)
    return Math.max(0, this.maxPerMinute - this.records.length)
  }

  /** 重置所有记录 */
  reset(): void {
    this.records = []
  }
}
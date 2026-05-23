/**
 * 未完成调用的本地缓存
 * 防止网络断开导致工具调用结果丢失
 */
export class PendingCallCache {
  /** 缓存映射 */
  private cache = new Map<string, {
    /** 工具名称 */
    toolName: string;
    /** 工具参数 */
    args: Record<string, unknown>;
    /** 创建时间 */
    createdAt: number;
  }>()

  /**
   * 缓存一个待完成的调用
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   */
  add(callId: string, toolName: string, args: Record<string, unknown>): void {
    this.cache.set(callId, { toolName, args, createdAt: Date.now() })
  }

  /**
   * 调用完成后移除缓存
   * @param callId 调用ID
   */
  remove(callId: string): void {
    this.cache.delete(callId)
  }

  /**
   * 获取所有超时的调用（超过 5 分钟未完成）
   * @returns {Array} 超时调用列表
   */
  getStaleCalls(): Array<{ callId: string; toolName: string; age: number }> {
    const now = Date.now()
    const stale: Array<{ callId: string; toolName: string; age: number }> = []
    for (const [callId, call] of this.cache) {
      const age = now - call.createdAt
      if (age > 5 * 60 * 1000) {
        stale.push({ callId, toolName: call.toolName, age })
      }
    }
    return stale
  }

  /** 清理所有缓存 */
  clear(): void {
    this.cache.clear()
  }

  /** 获取缓存大小 */
  get size(): number {
    return this.cache.size
  }
}

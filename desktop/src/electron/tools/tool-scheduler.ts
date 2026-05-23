/** 工具执行锁 */
export class ToolScheduler {
  /** 当前正在执行的工具调用 */
  private runningCalls = new Map<string, { toolName: string; startedAt: number }>()

  /** 等待队列 */
  private queue: Array<{
    /** 调用ID */
    callId: string;
    /** 工具名称 */
    toolName: string;
    /** 工具参数 */
    args: Record<string, unknown>;
    /** resolve 回调 */
    resolve: (result: unknown) => void;
    /** reject 回调 */
    reject: (error: Error) => void;
  }> = []

  /** 需要互斥的工具列表（同一时间只允许一个执行） */
  private mutexTools = new Set([
    'take_screenshot',
    'execute_command',
    'set_volume',
    'set_brightness',
    'switch_to_window',
  ])

  /** 独占类工具（执行后取消所有等待中的调用） */
  private exclusiveTools = new Set([
    'shutdown',
    'sleep',
  ])

  /**
   * 调度工具执行
   * @param callId 调用ID
   * @param toolName 工具名称
   * @param args 工具参数
   * @param executor 实际执行函数
   * @returns {Promise<unknown>} 执行结果
   */
  async schedule(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
    executor: () => Promise<unknown>,
  ): Promise<unknown> {
    if (this.exclusiveTools.has(toolName)) {
      this.cancelAllPending()
    }

    if (!this.mutexTools.has(toolName)) {
      return executor()
    }

    if (this.isToolRunning(toolName)) {
      return new Promise((resolve, reject) => {
        this.queue.push({ callId, toolName, args, resolve, reject })
      })
    }

    this.runningCalls.set(callId, { toolName, startedAt: Date.now() })
    try {
      const result = await executor()
      return result
    } finally {
      this.runningCalls.delete(callId)
      this.processQueue()
    }
  }

  /** 检查工具是否正在执行 */
  private isToolRunning(toolName: string): boolean {
    for (const [, call] of this.runningCalls) {
      if (call.toolName === toolName) return true
    }
    return false
  }

  /** 处理等待队列 */
  private processQueue(): void {
    if (this.queue.length === 0) return
    const next = this.queue.shift()!
    if (!this.isToolRunning(next.toolName)) {
      this.runningCalls.set(next.callId, { toolName: next.toolName, startedAt: Date.now() })
    }
  }

  /** 取消所有等待中的调用 */
  private cancelAllPending(): void {
    for (const item of this.queue) {
      item.reject(new Error('操作已被独占类工具取消'))
    }
    this.queue = []
  }
}

/** 全局工具调度器实例 */
export const toolScheduler = new ToolScheduler()

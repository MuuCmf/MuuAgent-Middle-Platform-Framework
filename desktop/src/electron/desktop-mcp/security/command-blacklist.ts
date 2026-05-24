/**
 * 命令执行黑名单检查
 * 基于正则表达式，防止危险命令执行
 */
export class CommandBlacklist {
  /** 黑名单规则列表 */
  private patterns: RegExp[] = []
  /** 是否启用 */
  private enabled = true

  /**
   * @param patterns 黑名单正则表达式列表
   */
  constructor(patterns: string[] = []) {
    this.setPatterns(patterns)
  }

  /**
   * 检查命令是否命中黑名单
   * @param command 待检查的命令
   * @returns {{ allowed: boolean; matched?: string }} 检查结果
   */
  check(command: string): { allowed: boolean; matched?: string } {
    if (!this.enabled || this.patterns.length === 0) {
      return { allowed: true }
    }

    const lowerCommand = command.toLowerCase()
    for (const pattern of this.patterns) {
      if (pattern.test(lowerCommand)) {
        return { allowed: false, matched: pattern.source }
      }
    }
    return { allowed: true }
  }

  /**
   * 更新黑名单规则
   * @param patterns 新的正则表达式列表
   */
  setPatterns(patterns: string[]): void {
    this.patterns = patterns
      .map(p => {
        try {
          return new RegExp(p, 'i')
        } catch {
          console.warn(`[CommandBlacklist] 无效的正则表达式: ${p}`)
          return null
        }
      })
      .filter((p): p is RegExp => p !== null)
  }

  /**
   * 启用/禁用黑名单
   * @param enabled 是否启用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 获取当前黑名单规则数量
   * @returns {number} 规则数量
   */
  getPatternCount(): number {
    return this.patterns.length
  }
}
/**
 * 域名过滤器
 * 用于检查 URL 是否允许访问
 */
export class DomainFilter {
  /** 域名黑名单正则表达式列表 */
  private blacklistPatterns: RegExp[] = []
  /** 域名白名单正则表达式列表 */
  private whitelistPatterns: RegExp[] = []

  /**
   * @param blacklist 黑名单正则表达式列表
   * @param whitelist 白名单正则表达式列表
   */
  constructor(blacklist: string[] = [], whitelist: string[] = []) {
    this.setBlacklist(blacklist)
    this.setWhitelist(whitelist)
  }

  /**
   * 设置黑名单
   * @param patterns 正则表达式字符串列表
   */
  setBlacklist(patterns: string[]): void {
    this.blacklistPatterns = patterns.map(p => new RegExp(p, 'i'))
  }

  /**
   * 设置白名单
   * @param patterns 正则表达式字符串列表
   */
  setWhitelist(patterns: string[]): void {
    this.whitelistPatterns = patterns.map(p => new RegExp(p, 'i'))
  }

  /**
   * 检查 URL 是否允许访问
   * @param url 要检查的 URL
   * @returns {boolean} 是否允许
   */
  isAllowed(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname

      /** 白名单优先：如果在白名单中，直接允许 */
      if (this.whitelistPatterns.length > 0) {
        for (const pattern of this.whitelistPatterns) {
          if (pattern.test(hostname)) {
            return true
          }
        }
        /** 有白名单但不在白名单中，拒绝 */
        return false
      }

      /** 黑名单检查：如果在黑名单中，拒绝 */
      for (const pattern of this.blacklistPatterns) {
        if (pattern.test(hostname)) {
          return false
        }
      }

      /** 无白名单且不在黑名单中，允许 */
      return true
    } catch {
      /** URL 解析失败，拒绝 */
      return false
    }
  }

  /**
   * 获取拒绝原因
   * @param url 要检查的 URL
   * @returns {string | null} 拒绝原因，null 表示允许
   */
  getRejectReason(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname

      /** 白名单检查 */
      if (this.whitelistPatterns.length > 0) {
        const inWhitelist = this.whitelistPatterns.some(p => p.test(hostname))
        if (!inWhitelist) {
          return `域名不在白名单中: ${hostname}`
        }
      }

      /** 黑名单检查 */
      for (const pattern of this.blacklistPatterns) {
        if (pattern.test(hostname)) {
          return `域名在黑名单中: ${hostname} (匹配规则: ${pattern.source})`
        }
      }

      return null
    } catch {
      return `URL 解析失败: ${url}`
    }
  }

  /**
   * 添加黑名单规则
   * @param pattern 正则表达式字符串
   */
  addToBlacklist(pattern: string): void {
    this.blacklistPatterns.push(new RegExp(pattern, 'i'))
  }

  /**
   * 添加白名单规则
   * @param pattern 正则表达式字符串
   */
  addToWhitelist(pattern: string): void {
    this.whitelistPatterns.push(new RegExp(pattern, 'i'))
  }

  /**
   * 清空黑名单
   */
  clearBlacklist(): void {
    this.blacklistPatterns = []
  }

  /**
   * 清空白名单
   */
  clearWhitelist(): void {
    this.whitelistPatterns = []
  }

  /**
   * 获取当前黑名单规则
   * @returns {string[]} 正则表达式字符串列表
   */
  getBlacklistPatterns(): string[] {
    return this.blacklistPatterns.map(p => p.source)
  }

  /**
   * 获取当前白名单规则
   * @returns {string[]} 正则表达式字符串列表
   */
  getWhitelistPatterns(): string[] {
    return this.whitelistPatterns.map(p => p.source)
  }
}
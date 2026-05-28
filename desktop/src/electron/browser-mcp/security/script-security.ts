/**
 * 脚本安全检查器
 * 用于检查 JavaScript 脚本是否安全执行
 */
export class ScriptSecurityChecker {
  /** 危险关键字列表 */
  private dangerousKeywords: string[] = [
    'eval',
    'Function',
    'constructor',
    'prototype',
    '__proto__',
    'require',
    'import',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'cookie',
    'document.cookie',
    'window.location',
    'window.open',
    'window.close',
    'navigator',
    'process',
    'global',
    'Buffer',
    'child_process',
    'fs',
    'path',
    'os',
    'crypto',
    'dns',
    'net',
    'http',
    'https',
    'url',
    'util',
    'vm',
    'worker_threads',
    'cluster',
    'dgram',
    'readline',
    'repl',
    'stream',
    'tls',
    'tty',
    'zlib',
  ]

  /** 危险模式正则表达式列表 */
  private dangerousPatterns: RegExp[] = [
    /\beval\s*\(/i,
    /new\s+Function\s*\(/i,
    /\.constructor\s*\(/i,
    /\.__proto__/i,
    /\.prototype\s*\[/i,
    /require\s*\(/i,
    /import\s+/i,
    /fetch\s*\(/i,
    /new\s+XMLHttpRequest\s*\(/i,
    /new\s+WebSocket\s*\(/i,
    /localStorage\s*\[/i,
    /sessionStorage\s*\[/i,
    /indexedDB\s*\./i,
    /document\.cookie/i,
    /window\.location\s*\=/i,
    /window\.open\s*\(/i,
    /window\.close\s*\(/i,
    /navigator\s*\./i,
    /process\s*\./i,
    /global\s*\./i,
    /Buffer\s*\./i,
    /child_process\s*\./i,
    /fs\s*\./i,
    /\.exec\s*\(/i,
    /\.spawn\s*\(/i,
    /\.fork\s*\(/i,
  ]

  /**
   * 检查脚本是否安全
   * @param script 要检查的脚本
   * @returns {boolean} 是否安全
   */
  isSafe(script: string): boolean {
    /** 检查危险关键字 */
    for (const keyword of this.dangerousKeywords) {
      if (this.containsKeyword(script, keyword)) {
        return false
      }
    }

    /** 检查危险模式 */
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(script)) {
        return false
      }
    }

    return true
  }

  /**
   * 获取不安全原因
   * @param script 要检查的脚本
   * @returns {string | null} 不安全原因，null 表示安全
   */
  getUnsafeReason(script: string): string | null {
    /** 检查危险关键字 */
    for (const keyword of this.dangerousKeywords) {
      if (this.containsKeyword(script, keyword)) {
        return `脚本包含危险关键字: ${keyword}`
      }
    }

    /** 检查危险模式 */
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(script)) {
        return `脚本包含危险模式: ${pattern.source}`
      }
    }

    return null
  }

  /**
   * 检查脚本是否包含关键字（考虑上下文）
   * @param script 脚本内容
   * @param keyword 关键字
   * @returns {boolean} 是否包含
   */
  private containsKeyword(script: string, keyword: string): boolean {
    /** 简单检查：关键字作为独立单词出现 */
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    return regex.test(script)
  }

  /**
   * 添加危险关键字
   * @param keyword 关键字
   */
  addDangerousKeyword(keyword: string): void {
    this.dangerousKeywords.push(keyword)
  }

  /**
   * 添加危险模式
   * @param pattern 正则表达式字符串
   */
  addDangerousPattern(pattern: string): void {
    this.dangerousPatterns.push(new RegExp(pattern, 'i'))
  }

  /**
   * 设置危险关键字列表
   * @param keywords 关键字列表
   */
  setDangerousKeywords(keywords: string[]): void {
    this.dangerousKeywords = keywords
  }

  /**
   * 设置危险模式列表
   * @param patterns 正则表达式字符串列表
   */
  setDangerousPatterns(patterns: string[]): void {
    this.dangerousPatterns = patterns.map(p => new RegExp(p, 'i'))
  }

  /**
   * 获取当前危险关键字列表
   * @returns {string[]} 关键字列表
   */
  getDangerousKeywords(): string[] {
    return this.dangerousKeywords
  }

  /**
   * 获取当前危险模式列表
   * @returns {string[]} 正则表达式字符串列表
   */
  getDangerousPatterns(): string[] {
    return this.dangerousPatterns.map(p => p.source)
  }

  /**
   * 清空所有规则
   */
  clear(): void {
    this.dangerousKeywords = []
    this.dangerousPatterns = []
  }
}
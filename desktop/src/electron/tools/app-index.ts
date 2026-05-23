import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/** 应用索引条目 */
interface AppIndexEntry {
  /** 应用显示名称（快捷方式文件名，不含扩展名） */
  name: string
  /** .lnk 快捷方式文件完整路径 */
  lnkPath: string
  /** 快捷方式指向的可执行文件路径（可能为空） */
  targetExe: string
  /** 可执行文件名（如 WeChat.exe），用于关闭应用时匹配进程 */
  exeName: string
}

/** 常见应用别名映射（小写 key → 标准名称） */
const APP_ALIASES: Record<string, string[]> = {
  'vs code': ['Visual Studio Code'],
  'vscode': ['Visual Studio Code'],
  'visual studio code': ['Visual Studio Code'],
  'word': ['Word', 'Microsoft Word'],
  'excel': ['Excel', 'Microsoft Excel'],
  'powerpoint': ['PowerPoint', 'Microsoft PowerPoint'],
  'ppt': ['PowerPoint', 'Microsoft PowerPoint'],
  'chrome': ['Google Chrome'],
  'edge': ['Microsoft Edge'],
  'firefox': ['Mozilla Firefox'],
  'wechat': ['微信'],
  'weixin': ['微信'],
  'qq': ['腾讯QQ'],
  'tim': ['腾讯TIM'],
  'notepad': ['记事本'],
  'calculator': ['计算器'],
  'paint': ['画图'],
  'explorer': ['文件资源管理器'],
  'terminal': ['终端', 'Windows Terminal'],
  'cmd': ['命令提示符'],
  'powershell': ['Windows PowerShell'],
  'settings': ['设置'],
  'store': ['Microsoft Store'],
  'steam': ['Steam'],
  'discord': ['Discord'],
  'spotify': ['Spotify'],
  'figma': ['Figma'],
  'notion': ['Notion'],
  'obs': ['OBS Studio'],
  'blender': ['Blender'],
  'unity': ['Unity Hub', 'Unity'],
  'docker': ['Docker Desktop'],
  'postman': ['Postman'],
  'cursor': ['Cursor'],
  'windsurf': ['Windsurf'],
  'trae': ['Trae'],
}

/**
 * Windows 应用索引服务
 * 启动时扫描开始菜单和桌面快捷方式，构建 name → .lnk 映射
 * 调用 launch_application 时直接查表 + shell.openPath() 打开 .lnk
 */
export class AppIndex {
  /** 名称到索引条目的映射（小写 key 用于模糊匹配） */
  private index = new Map<string, AppIndexEntry>()

  /** 可执行文件名到显示名称的反向映射（用于 close_application） */
  private exeToName = new Map<string, string>()

  /** 索引是否已构建 */
  private built = false

  /**
   * 构建应用索引
   * 扫描开始菜单和桌面的 .lnk 文件，批量解析目标路径
   * @returns {Promise<void>}
   */
  async build(): Promise<void> {
    if (this.built) return

    const dirs = this.getScanDirs()
    const lnkFiles: string[] = []

    /** 先收集所有 .lnk 文件路径 */
    for (const dir of dirs) {
      this.collectLnkFiles(dir, lnkFiles)
    }

    /** 批量解析 .lnk 文件（一次 PowerShell 调用） */
    if (lnkFiles.length > 0 && process.platform === 'win32') {
      await this.batchParseLnkFiles(lnkFiles)
    } else {
      /** 非 Windows 或无 .lnk 文件时逐个处理 */
      for (const lnk of lnkFiles) {
        this.indexShortcutWithoutTarget(lnk)
      }
    }

    /** macOS 应用 */
    if (process.platform === 'darwin') {
      for (const dir of dirs) {
        this.scanMacApps(dir)
      }
    }

    this.built = true
  }

  /**
   * 重新构建索引（用户安装新应用后可调用）
   * @returns {Promise<void>}
   */
  async rebuild(): Promise<void> {
    this.index.clear()
    this.exeToName.clear()
    this.built = false
    await this.build()
  }

  /**
   * 查找应用
   * 匹配优先级：精确匹配 → 别名映射 → 子串匹配 → 单词匹配 → exeName 匹配
   * @param name 应用名称
   * @returns {AppIndexEntry | null} 匹配的应用条目，未找到返回 null
   */
  find(name: string): AppIndexEntry | null {
    const lower = name.toLowerCase()

    /** 1. 精确匹配 */
    const exact = this.index.get(lower)
    if (exact) return exact

    /** 2. 别名映射（VS Code → Visual Studio Code） */
    const aliases = APP_ALIASES[lower]
    if (aliases) {
      for (const alias of aliases) {
        const found = this.index.get(alias.toLowerCase())
        if (found) return found
      }
    }

    /** 3. 子串匹配：搜索词是索引 key 的子串，或反过来 */
    for (const [key, entry] of this.index) {
      if (key.includes(lower) || lower.includes(key)) {
        return entry
      }
    }

    /** 4. 单词匹配：搜索词的每个单词都在索引 key 中出现 */
    const searchWords = lower.split(/\s+/).filter(w => w.length > 1)
    if (searchWords.length > 1) {
      for (const [key, entry] of this.index) {
        const keyWords = key.split(/\s+/)
        if (searchWords.every(sw => keyWords.some(kw => kw.includes(sw) || sw.includes(kw)))) {
          return entry
        }
      }
    }

    /** 5. exeName 匹配：搜索词匹配可执行文件名（不含 .exe） */
    for (const [key, entry] of this.index) {
      if (entry.exeName) {
        const exeBase = entry.exeName.replace(/\.exe$/i, '').toLowerCase()
        if (exeBase === lower || exeBase.includes(lower) || lower.includes(exeBase)) {
          return entry
        }
      }
    }

    return null
  }

  /**
   * 模糊搜索应用，返回多个匹配结果
   * @param query 搜索关键词
   * @param maxResults 最大返回数量
   * @returns {Array<{name: string; exeName: string}>} 匹配的应用列表
   */
  search(query: string, maxResults: number = 10): Array<{ name: string; exeName: string }> {
    const lower = query.toLowerCase()
    const results: Array<{ name: string; exeName: string; score: number }> = []

    for (const [key, entry] of this.index) {
      let score = 0

      if (key === lower) score = 100
      else if (key.startsWith(lower)) score = 80
      else if (key.includes(lower)) score = 60
      else if (lower.includes(key)) score = 40
      else {
        const words = lower.split(/\s+/).filter(w => w.length > 1)
        const matched = words.filter(w => key.includes(w)).length
        if (matched > 0) score = (matched / words.length) * 30
      }

      if (score > 0) {
        results.push({ name: entry.name, exeName: entry.exeName, score })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ name, exeName }) => ({ name, exeName }))
  }

  /**
   * 通过可执行文件名查找显示名称
   * @param exeName 可执行文件名（如 WeChat.exe）
   * @returns {string | null} 显示名称，未找到返回 null
   */
  findNameByExe(exeName: string): string | null {
    const lower = exeName.toLowerCase()
    return this.exeToName.get(lower) || null
  }

  /**
   * 获取所有已索引的应用名称列表
   * @returns {string[]} 应用名称列表
   */
  getAllNames(): string[] {
    return Array.from(this.index.values()).map(e => e.name)
  }

  /**
   * 启动应用
   * 通过 shell.openPath() 打开 .lnk 文件，Windows 会自动启动目标程序
   * 索引未命中时，依次尝试 where / start 命令
   * @param name 应用名称
   * @returns {Promise<{launched: boolean; path?: string; exeName?: string}>} 启动结果
   */
  async launch(name: string): Promise<{ launched: boolean; path?: string; exeName?: string }> {
    await this.build()

    const entry = this.find(name)
    if (entry) {
      const result = await shell.openPath(entry.lnkPath)
      if (result === '') {
        return { launched: true, path: entry.lnkPath, exeName: entry.exeName }
      }
      /** .lnk 打开失败时，尝试直接打开目标 exe */
      if (entry.targetExe) {
        const fallback = await shell.openPath(entry.targetExe)
        if (fallback === '') {
          return { launched: true, path: entry.targetExe, exeName: entry.exeName }
        }
      }
      return { launched: false, path: entry.lnkPath }
    }

    /** 索引中未找到，尝试直接用 shell.openPath 打开（可能是路径或 URL） */
    const directResult = await shell.openPath(name)
    if (directResult === '') {
      return { launched: true, path: name }
    }

    /** Windows fallback: where 查找可执行文件 */
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`where "${name}"`, { timeout: 5000 })
        const found = stdout.trim().split('\n')[0].trim()
        if (found) {
          const openResult = await shell.openPath(found)
          if (openResult === '') {
            return { launched: true, path: found }
          }
        }
      } catch { /* where 未找到 */ }

      try {
        await execAsync(`start "" "${name}"`, { timeout: 10000 })
        return { launched: true, path: name }
      } catch { /* start 也失败 */ }
    }

    /** macOS fallback: open -a */
    if (process.platform === 'darwin') {
      try {
        await execAsync(`open -a "${name}"`, { timeout: 10000 })
        return { launched: true, path: name }
      } catch { /* open 失败 */ }
    }

    return { launched: false }
  }

  /**
   * 获取扫描目录列表
   * @returns {string[]} 需要扫描的目录路径列表
   */
  private getScanDirs(): string[] {
    const dirs: string[] = []

    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || ''
      const home = os.homedir()

      if (appData) {
        dirs.push(path.join(appData, 'Microsoft\\Windows\\Start Menu\\Programs'))
      }
      dirs.push('C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs')
      dirs.push(path.join(home, 'Desktop'))
      dirs.push(path.join(home, 'AppData\\Roaming\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar'))
    } else if (process.platform === 'darwin') {
      dirs.push('/Applications')
    }

    return dirs.filter(d => {
      try { return fs.existsSync(d) } catch { return false }
    })
  }

  /**
   * 递归收集 .lnk 文件路径
   * @param dir 目录路径
   * @param results 收集结果数组
   */
  private collectLnkFiles(dir: string, results: string[]): void {
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        this.collectLnkFiles(fullPath, results)
      } else if (entry.name.endsWith('.lnk')) {
        results.push(fullPath)
      }
    }
  }

  /**
   * 批量解析 .lnk 文件
   * 使用一次 PowerShell 调用解析所有 .lnk，避免逐个调用的开销
   * @param lnkFiles .lnk 文件路径列表
   * @returns {Promise<void>}
   */
  private async batchParseLnkFiles(lnkFiles: string[]): Promise<void> {
    /** 分批处理，每批最多 100 个，避免 PowerShell 命令行过长 */
    const batchSize = 100

    for (let i = 0; i < lnkFiles.length; i += batchSize) {
      const batch = lnkFiles.slice(i, i + batchSize)
      const lnkList = batch.map(p => `'${p.replace(/'/g, "''")}'`).join(',')

      const psScript = `
$shell = New-Object -ComObject WScript.Shell
$lnks = @(${lnkList})
foreach ($lnk in $lnks) {
  if (-not (Test-Path $lnk)) { continue }
  $sc = $shell.CreateShortcut($lnk)
  $target = $sc.TargetPath
  Write-Output "$lnk|$target"
}
`.trim()

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
          { timeout: 30000 },
        )

        for (const line of stdout.trim().split('\n').filter(Boolean)) {
          const sepIdx = line.indexOf('|')
          if (sepIdx < 0) continue

          const lnkPath = line.substring(0, sepIdx)
          const targetExe = line.substring(sepIdx + 1)
          const baseName = path.basename(lnkPath, '.lnk')

          if (this.index.has(baseName.toLowerCase())) continue

          let exeName = ''
          if (targetExe && (targetExe.endsWith('.exe') || targetExe.endsWith('.EXE'))) {
            exeName = path.basename(targetExe)
          }

          const entry: AppIndexEntry = {
            name: baseName,
            lnkPath,
            targetExe,
            exeName,
          }

          this.index.set(baseName.toLowerCase(), entry)

          if (exeName) {
            this.exeToName.set(exeName.toLowerCase(), baseName)
          }
        }
      } catch {
        /** 批量解析失败时，逐个降级处理 */
        for (const lnk of batch) {
          this.indexShortcutWithoutTarget(lnk)
        }
      }
    }
  }

  /**
   * 不解析目标路径，仅索引 .lnk 文件名
   * 作为批量解析失败时的降级方案
   * @param lnkPath .lnk 文件路径
   */
  private indexShortcutWithoutTarget(lnkPath: string): void {
    const baseName = path.basename(lnkPath, '.lnk')

    if (this.index.has(baseName.toLowerCase())) return

    this.index.set(baseName.toLowerCase(), {
      name: baseName,
      lnkPath,
      targetExe: '',
      exeName: '',
    })
  }

  /**
   * 扫描 macOS 应用目录
   * @param dir 目录路径
   */
  private scanMacApps(dir: string): void {
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.endsWith('.app')) {
        const baseName = path.basename(entry.name, '.app')
        const fullPath = path.join(dir, entry.name)

        if (this.index.has(baseName.toLowerCase())) continue

        this.index.set(baseName.toLowerCase(), {
          name: baseName,
          lnkPath: fullPath,
          targetExe: fullPath,
          exeName: baseName,
        })
      }
    }
  }
}

/** 全局单例 */
export const appIndex = new AppIndex()

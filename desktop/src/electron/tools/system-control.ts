import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { clipboard, nativeImage, Notification, shell, systemPreferences } from 'electron'
import { screenshot } from './screenshot'
import { appIndex } from './app-index'

const execAsync = promisify(exec)

/** 进程信息 */
interface ProcessInfo {
  /** 进程名称 */
  name: string
  /** 进程ID */
  pid: number
  /** 内存占用（MB） */
  memory: number
}

/** 文件信息 */
interface FileInfo {
  /** 文件名 */
  name: string
  /** 文件路径 */
  path: string
  /** 是否为目录 */
  isDirectory: boolean
  /** 文件大小（字节） */
  size: number
}

/** 命令执行结果 */
interface CommandResult {
  /** 标准输出 */
  stdout: string
  /** 标准错误 */
  stderr: string
  /** 退出码 */
  exitCode: number | null
}

/** 窗口信息 */
interface WindowInfo {
  /** 窗口标题 */
  title: string
  /** 所属应用 */
  owner: string
}

/**
 * 系统控制工具实现
 * 在 Electron 主进程中执行系统级操作
 */
export class SystemControlTools {

  /**
   * 启动应用程序
   * 通过 AppIndex 查找应用索引，使用 shell.openPath() 打开 .lnk 快捷方式
   * @param name 应用名称（支持中文名，如"微信"、"Chrome"）
   * @returns {Promise<{launched: boolean; path?: string}>} 是否启动成功及实际启动路径
   */
  async launchApplication(name: string): Promise<{ launched: boolean; path?: string }> {
    const result = await appIndex.launch(name)
    if (result.launched) {
      return { launched: true, path: result.path }
    }
    throw new Error(`找不到应用 "${name}"，请确认应用名称是否正确或应用是否已安装`)
  }

  /**
   * 关闭应用程序
   * 优先使用 AppIndex 中的 exeName 映射找到真实进程名，再 taskkill
   * @param name 应用名称
   * @returns {Promise<{closed: boolean; processName?: string}>} 是否关闭成功及实际关闭的进程名
   */
  async closeApplication(name: string): Promise<{ closed: boolean; processName?: string }> {
    const platform = process.platform

    if (platform === 'win32') {
      return this.closeApplicationWindows(name)
    } else if (platform === 'darwin') {
      try {
        await execAsync(`osascript -e 'quit app "${name}"'`, { timeout: 10000 })
        return { closed: true }
      } catch {
        return { closed: false }
      }
    } else {
      try {
        await execAsync(`pkill -f "${name}"`, { timeout: 10000 })
        return { closed: true }
      } catch {
        return { closed: false }
      }
    }
  }

  /**
   * Windows 平台关闭应用
   * 通过 AppIndex 查找 exeName，再 taskkill
   * @param name 应用名称
   * @returns {Promise<{closed: boolean; processName?: string}>} 关闭结果
   */
  private async closeApplicationWindows(name: string): Promise<{ closed: boolean; processName?: string }> {
    /** 1. 从 AppIndex 查找真实 exeName */
    const entry = appIndex.find(name)
    if (entry?.exeName) {
      try {
        await execAsync(`taskkill /IM "${entry.exeName}" /F`, { timeout: 10000 })
        return { closed: true, processName: entry.exeName }
      } catch {}
    }

    /** 2. 尝试直接用 name.exe 关闭 */
    try {
      await execAsync(`taskkill /IM "${name}.exe" /F`, { timeout: 10000 })
      return { closed: true, processName: `${name}.exe` }
    } catch {}

    /** 3. 通过 tasklist 模糊匹配窗口标题查找进程 */
    const psScript = `
$name = '${name.replace(/'/g, "''")}'
$procs = Get-Process | Where-Object {
  $_.MainWindowTitle -like "*$name*" -or
  $_.ProcessName -like "*$name*" -or
  $_.Description -like "*$name*"
} | Select-Object -First 5 ProcessName, Id

if ($procs) {
  $procs | ForEach-Object { "$($_.ProcessName)|$($_.Id)" }
}
`.trim()

    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 10000 })
      const lines = stdout.trim().split('\n').filter(Boolean)

      if (lines.length > 0) {
        let closed = false
        let processName = ''
        for (const line of lines) {
          const [pName, pid] = line.split('|')
          try {
            await execAsync(`taskkill /PID ${pid} /F`, { timeout: 5000 })
            closed = true
            processName = pName
          } catch {}
        }
        return { closed, processName }
      }
    } catch {}

    return { closed: false }
  }

  /**
   * 列出正在运行的进程
   * @returns {Promise<ProcessInfo[]>} 进程列表
   */
  async listProcesses(): Promise<ProcessInfo[]> {
    const platform = process.platform
    let command: string

    if (platform === 'win32') {
      command = 'tasklist /FO CSV /NH'
    } else {
      command = 'ps aux --sort=-%mem | head -50'
    }

    const { stdout } = await execAsync(command, { timeout: 10000 })
    return this.parseProcessList(stdout, platform)
  }

  /**
   * 截取屏幕画面
   * @returns {Promise<{imageBase64: string}>} 截图的 Base64 编码
   */
  async takeScreenshot(): Promise<{ imageBase64: string }> {
    const image = await screenshot()
    return { imageBase64: image.toDataURL().replace(/^data:image\/png;base64,/, '') }
  }

  /**
   * 设置系统音量
   * @param level 音量级别 0-100
   * @returns {Promise<{level: number}>} 设置后的音量
   */
  async setVolume(level: number): Promise<{ level: number }> {
    const clamped = Math.max(0, Math.min(100, level))
    const platform = process.platform

    if (platform === 'win32') {
      await execAsync(`nircmd.exe setsysvolume ${Math.round(clamped * 655.35)}`, { timeout: 5000 })
    } else if (platform === 'darwin') {
      await execAsync(`osascript -e "set volume output volume ${clamped}"`, { timeout: 5000 })
    } else {
      await execAsync(`amixer set Master ${clamped}%`, { timeout: 5000 })
    }

    return { level: clamped }
  }

  /**
   * 获取当前系统音量
   * @returns {Promise<{level: number}>} 当前音量
   */
  async getVolume(): Promise<{ level: number }> {
    const platform = process.platform

    if (platform === 'darwin') {
      const { stdout } = await execAsync('osascript -e "output volume of (get volume settings)"', { timeout: 5000 })
      return { level: parseInt(stdout.trim(), 10) }
    }

    return { level: -1 }
  }

  /**
   * 读取剪贴板内容
   * @returns {Promise<{text: string}>} 剪贴板文本
   */
  async readClipboard(): Promise<{ text: string }> {
    const text = clipboard.readText()
    return { text }
  }

  /**
   * 写入内容到剪贴板
   * @param text 要写入的文本
   * @returns {Promise<{written: boolean}>} 是否写入成功
   */
  async writeClipboard(text: string): Promise<{ written: boolean }> {
    clipboard.writeText(text)
    return { written: true }
  }

  /**
   * 搜索文件
   * @param query 搜索关键词
   * @param basePath 搜索根目录
   * @returns {Promise<FileInfo[]>} 匹配的文件列表
   */
  async searchFiles(query: string, basePath?: string): Promise<FileInfo[]> {
    const searchPath = basePath || os.homedir()
    const platform = process.platform
    let command: string

    if (platform === 'win32') {
      command = `dir /s /b "${searchPath}\\*${query}*"`
    } else {
      command = `find "${searchPath}" -maxdepth 5 -iname "*${query}*" -type f 2>/dev/null | head -50`
    }

    try {
      const { stdout } = await execAsync(command, { timeout: 15000 })
      const files = stdout.trim().split('\n').filter(Boolean).slice(0, 50)
      return files.map((filePath) => {
        try {
          const stat = fs.statSync(filePath)
          return {
            name: path.basename(filePath),
            path: filePath,
            isDirectory: stat.isDirectory(),
            size: stat.size,
          }
        } catch {
          return { name: path.basename(filePath), path: filePath, isDirectory: false, size: 0 }
        }
      })
    } catch {
      return []
    }
  }

  /**
   * 用系统默认程序打开文件
   * @param filePath 文件路径
   * @returns {Promise<{opened: boolean}>} 是否打开成功
   */
  async openFile(filePath: string): Promise<{ opened: boolean }> {
    const result = await shell.openPath(filePath)
    return { opened: result === '' }
  }

  /**
   * 列出当前打开的窗口
   * @returns {Promise<WindowInfo[]>} 窗口列表
   */
  async listOpenWindows(): Promise<WindowInfo[]> {
    const platform = process.platform

    if (platform === 'win32') {
      const { stdout } = await execAsync('tasklist /V /FO CSV /NH', { timeout: 10000 })
      return this.parseWindowList(stdout, platform)
    } else if (platform === 'darwin') {
      const { stdout } = await execAsync('osascript -e \'tell application "System Events" to get name of every window of every process whose visible is true\'', { timeout: 10000 })
      return this.parseWindowList(stdout, platform)
    }

    return []
  }

  /**
   * 切换到指定窗口
   * @param title 窗口标题关键词
   * @returns {Promise<{switched: boolean}>} 是否切换成功
   */
  async switchToWindow(title: string): Promise<{ switched: boolean }> {
    const platform = process.platform

    if (platform === 'darwin') {
      try {
        await execAsync(`osascript -e 'tell application "System Events" to set frontmost of every process whose name contains "${title}" to true'`, { timeout: 5000 })
        return { switched: true }
      } catch {
        return { switched: false }
      }
    }

    return { switched: false }
  }

  /**
   * 显示系统通知
   * @param title 通知标题
   * @param body 通知内容
   * @returns {Promise<{shown: boolean}>} 是否显示成功
   */
  async showNotification(title: string, body: string): Promise<{ shown: boolean }> {
    const notification = new Notification({ title, body })
    notification.show()
    return { shown: true }
  }

  /**
   * 执行系统命令
   * 特殊处理 explorer 命令：Windows 上 explorer.exe 通过 child_process 执行会返回非零退出码，
   * 即使实际已成功打开，导致 LLM 误判为失败并反复重试。改用 shell.openPath() 解决。
   * @param command 要执行的命令
   * @param timeout 超时时间（毫秒）
   * @returns {Promise<CommandResult>} 命令执行结果
   */
  async executeCommand(command: string, timeout: number = 10000): Promise<CommandResult> {
    /** Windows: 拦截 explorer 命令，改用 shell.openPath */
    if (process.platform === 'win32') {
      const explorerMatch = command.match(/^explorer\.exe\s+(.+)$/i) || command.match(/^explorer\s+(.+)$/i)
      if (explorerMatch) {
        const target = explorerMatch[1].trim().replace(/^["']|["']$/g, '')
        const result = await shell.openPath(target)
        if (result === '') {
          return { stdout: `已打开: ${target}`, stderr: '', exitCode: 0 }
        }
        return { stdout: '', stderr: `打开失败: ${result}`, exitCode: 1 }
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout })
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
    } catch (error: any) {
      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1,
      }
    }
  }

  /**
   * 关闭计算机
   * @returns {Promise<{shutdown: boolean}>} 是否执行成功
   */
  async shutdown(): Promise<{ shutdown: boolean }> {
    const platform = process.platform
    let command: string

    if (platform === 'win32') {
      command = 'shutdown /s /t 60'
    } else if (platform === 'darwin') {
      command = 'osascript -e \'tell app "System Events" to shut down\''
    } else {
      command = 'shutdown -h +1'
    }

    await execAsync(command, { timeout: 10000 })
    return { shutdown: true }
  }

  /**
   * 使计算机进入睡眠状态
   * @returns {Promise<{sleep: boolean}>} 是否执行成功
   */
  async sleep(): Promise<{ sleep: boolean }> {
    const platform = process.platform
    let command: string

    if (platform === 'win32') {
      command = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
    } else if (platform === 'darwin') {
      command = 'osascript -e \'tell app "System Events" to sleep\''
    } else {
      command = 'systemctl suspend'
    }

    await execAsync(command, { timeout: 10000 })
    return { sleep: true }
  }

  /**
   * 解析进程列表输出
   * @param output 命令输出
   * @param platform 操作系统平台
   * @returns {ProcessInfo[]} 进程列表
   */
  private parseProcessList(output: string, platform: string): ProcessInfo[] {
    const processes: ProcessInfo[] = []

    if (platform === 'win32') {
      const lines = output.trim().split('\n')
      for (const line of lines) {
        const parts = line.replace(/"/g, '').split(',')
        if (parts.length >= 5) {
          processes.push({
            name: parts[0],
            pid: parseInt(parts[1], 10),
            memory: parseFloat(parts[4].replace(/[^\d.]/g, '')) || 0,
          })
        }
      }
    } else {
      const lines = output.trim().split('\n').slice(1)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 11) {
          processes.push({
            name: parts[10],
            pid: parseInt(parts[1], 10),
            memory: parseFloat(parts[5]) || 0,
          })
        }
      }
    }

    return processes.slice(0, 50)
  }

  /**
   * 解析窗口列表输出
   * @param output 命令输出
   * @param platform 操作系统平台
   * @returns {WindowInfo[]} 窗口列表
   */
  private parseWindowList(output: string, platform: string): WindowInfo[] {
    const windows: WindowInfo[] = []

    if (platform === 'win32') {
      const lines = output.trim().split('\n')
      for (const line of lines) {
        const parts = line.replace(/"/g, '').split(',')
        if (parts.length >= 1) {
          windows.push({ title: parts[0], owner: parts.length > 1 ? parts[1] : '' })
        }
      }
    } else if (platform === 'darwin') {
      const items = output.trim().split(', ')
      for (const item of items) {
        if (item.trim()) {
          windows.push({ title: item.trim(), owner: '' })
        }
      }
    }

    return windows.slice(0, 30)
  }
}

import { exec } from 'child_process'
import { ExecuteArgs, ToolResult } from '../types'
import { CommandBlacklist } from '../security/command-blacklist'

/** 命令黑名单实例（由外部注入） */
let blacklist: CommandBlacklist | null = null

/**
 * 设置命令黑名单实例
 * @param bl 黑名单实例
 */
export function setExecuteBlacklist(bl: CommandBlacklist): void {
  blacklist = bl
}

/**
 * 命令执行工具处理器
 * 使用 Node.js 原生 child_process.exec 执行系统命令
 * @param args 命令执行参数
 * @returns {Promise<ToolResult>} 执行结果（含 stdout/stderr）
 */
export async function executeHandler(args: ExecuteArgs): Promise<ToolResult> {
  const command: string = args.command
  const cwd: string | undefined = args.cwd
  const timeout: number = args.timeout || 30000

  /** 黑名单检查 */
  if (blacklist) {
    const check = blacklist.check(command)
    if (!check.allowed) {
      return {
        content: [{ type: 'text', text: `命令已被黑名单拦截。匹配规则: ${check.matched}` }],
        isError: true,
      }
    }
  }

  try {
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`命令执行超时（${timeout}ms）: ${command}`))
      }, timeout)

      exec(command, { cwd: cwd || process.cwd(), timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        clearTimeout(timer)
        if (error) {
          reject(error)
        } else {
          resolve({ stdout, stderr })
        }
      })
    })

    const output = buildOutput(result.stdout, result.stderr)
    return { content: [{ type: 'text', text: output }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `命令执行失败: ${message}` }],
      isError: true,
    }
  }
}

/**
 * 构建命令输出文本
 * @param stdout 标准输出
 * @param stderr 标准错误
 * @returns {string} 格式化后的输出文本
 */
function buildOutput(stdout: string, stderr: string): string {
  const parts: string[] = []
  if (stdout.trim()) {
    parts.push(`[stdout]\n${stdout.trim()}`)
  }
  if (stderr.trim()) {
    parts.push(`[stderr]\n${stderr.trim()}`)
  }
  if (parts.length === 0) {
    parts.push('命令执行完毕，无输出。')
  }
  return parts.join('\n\n')
}
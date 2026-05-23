/** 命令黑名单：直接拒绝执行 */
const COMMAND_BLACKLIST = [
  /rm\s+-rf\s+\//,
  /del\s+\/[sS]\s+\/[qQ]/,
  /format\s+[a-zA-Z]:/,
  /mkfs\./,
  /dd\s+if=/,
  /:\(\)\{.*;\};\s*:/,
  /shutdown/,
  /reboot/,
]

/** 命令白名单：无需确认即可执行 */
const COMMAND_WHITELIST = [
  /^ls\b/,
  /^dir\b/,
  /^cat\b/,
  /^type\b/,
  /^echo\b/,
  /^pwd\b/,
  /^cd\b/,
  /^ping\b/,
  /^ipconfig\b/,
  /^ifconfig\b/,
  /^whoami\b/,
  /^date\b/,
  /^time\b/,
  /^hostname\b/,
  /^systeminfo\b/,
  /^tasklist\b/,
  /^ps\b/,
]

/** 命令安全等级 */
type CommandSafetyLevel = 'allowed' | 'blocked' | 'needsConfirm'

/**
 * 检查命令安全性
 * @param command 待执行的命令
 * @returns {CommandSafetyLevel} 安全等级
 */
export function checkCommandSafety(command: string): CommandSafetyLevel {
  for (const pattern of COMMAND_BLACKLIST) {
    if (pattern.test(command)) return 'blocked'
  }
  for (const pattern of COMMAND_WHITELIST) {
    if (pattern.test(command)) return 'allowed'
  }
  return 'needsConfirm'
}

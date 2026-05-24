import Store from 'electron-store'

/** 桌面端配置结构定义 */
interface DesktopConfig {
  /** 语音设置 */
  voice: {
    /** ASR 服务地址 */
    asrUrl: string
    /** TTS 服务地址 */
    ttsUrl: string
    /** 语音模式：按键唤醒 / 唤醒词 */
    wakeMode: 'keypress' | 'wake-word'
    /** 唤醒词 */
    wakeWord: string
    /** 是否自动播报回复 */
    autoSpeak: boolean
  }
  /** 安全设置 */
  security: {
    /** 是否启用命令执行工具 */
    executeCommandEnabled: boolean
    /** 确认超时时间（秒） */
    confirmTimeout: number
  }
  /** 更新设置 */
  update: {
    /** 是否自动检查更新 */
    autoCheck: boolean
    /** 更新频道 */
    channel: 'stable' | 'beta'
  }
  /** Service 地址 */
  serviceUrl: string
  /** 桌面自动化设置 */
  automation: {
    /** 是否启用桌面自动化（总开关） */
    enabled: boolean
    /** 需要用户确认的操作类型列表 */
    requireConfirm: ('mouse' | 'keyboard' | 'execute' | 'clipboard')[]
    /** 确认超时时间（秒），超时自动拒绝 */
    confirmTimeout: number
    /** 操作频率限制（次/分钟），0 表示不限制 */
    rateLimit: number
    /** 命令执行黑名单（正则表达式） */
    commandBlacklist: string[]
    /** 是否记录操作日志 */
    enableLog: boolean
  }
}

/** 默认配置 */
const defaults: DesktopConfig = {
  voice: {
    asrUrl: '',
    ttsUrl: '',
    wakeMode: 'keypress',
    wakeWord: '',
    autoSpeak: false,
  },
  security: {
    executeCommandEnabled: false,
    confirmTimeout: 60,
  },
  update: {
    autoCheck: true,
    channel: 'stable',
  },
  serviceUrl: 'http://localhost:3000',
  automation: {
    enabled: true,
    requireConfirm: ['execute'],
    confirmTimeout: 60,
    rateLimit: 30,
    commandBlacklist: [
      'rm\\s+-rf',
      'Format-Volume',
      'del\\s+/[fs]',
      'shutdown',
      'Restart-Computer',
    ],
    enableLog: true,
  },
}

/** 配置存储实例 */
export const configStore = new Store<DesktopConfig>({
  defaults,
  name: 'muu-agent-desktop',
})

/**
 * 获取配置项值（类型安全访问）
 * @param key 配置键名
 * @returns 配置值
 */
export function getConfigValue<K extends keyof DesktopConfig>(key: K): DesktopConfig[K] {
  return (configStore as any).get(key)
}
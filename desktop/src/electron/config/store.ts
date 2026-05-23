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
}

/** 配置存储实例 */
export const configStore = new Store<DesktopConfig>({
  defaults,
  name: 'muu-agent-desktop',
})

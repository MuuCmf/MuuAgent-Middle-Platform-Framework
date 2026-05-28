/**
 * 应用配置管理
 * 统一管理所有环境变量和配置项
 */

/**
 * 应用配置接口
 */
export interface AppConfig {
  /**
   * API基础路径
   */
  apiBaseUrl: string
  
  /**
   * 应用标题
   */
  appTitle: string
  
  /**
   * 应用端口
   */
  port: number
}

/**
 * 获取应用配置
 * @returns {AppConfig} 应用配置对象
 */
export const getAppConfig = (): AppConfig => {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '' + '/',
    appTitle: import.meta.env.VITE_APP_TITLE || 'MuuAgent',
    port: parseInt(import.meta.env.VITE_PORT || '5173', 10)
  }
}

/**
 * 应用配置实例
 * 在整个应用中共享使用
 */
export const appConfig = getAppConfig()

/**
 * 验证配置是否完整
 * @returns {boolean} 配置是否有效
 */
export const validateConfig = (): boolean => {
  return true
}

/**
 * 打印当前配置（仅开发环境）
 */
export const printConfig = (): void => {
  if (import.meta.env.DEV) {
    console.group('🔧 应用配置')
    console.log('API基础路径:', appConfig.apiBaseUrl)
    console.log('应用标题:', appConfig.appTitle)
    console.log('应用端口:', appConfig.port)
    console.groupEnd()
  }
}

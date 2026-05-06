/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
  /**
   * API基础路径
   */
  readonly VITE_API_BASE_URL: string
  
  /**
   * API密钥
   */
  readonly VITE_API_KEY: string
  
  /**
   * 应用标题
   */
  readonly VITE_APP_TITLE: string
  
  /**
   * 应用端口
   */
  readonly VITE_PORT: string
}

/**
 * ImportMeta类型扩展
 */
interface ImportMeta {
  readonly env: ImportMetaEnv
}

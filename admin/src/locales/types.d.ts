/**
 * vue-i18n TypeScript 类型定义
 */
import { DefineLocaleMessage } from 'vue-i18n'
import zhCN from './locales/zh-CN'

/**
 * 语言消息类型
 * 基于中文语言包推断类型
 */
type MessageSchema = typeof zhCN

/**
 * 扩展 vue-i18n 类型
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}

export { MessageSchema }

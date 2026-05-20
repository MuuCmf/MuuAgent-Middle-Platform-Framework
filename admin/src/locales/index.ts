/**
 * 国际化配置
 */
import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

/**
 * 获取存储的语言设置
 * @returns {string} 语言代码
 */
const getStoredLocale = (): string => {
  const stored = localStorage.getItem('locale')
  if (stored && ['zh-CN', 'en-US'].includes(stored)) {
    return stored
  }

  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en-US'
}

/**
 * i18n 实例
 */
const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export default i18n

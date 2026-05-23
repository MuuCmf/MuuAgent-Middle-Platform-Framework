import { ref, computed, watch } from 'vue'

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark' | 'system'

/**
 * 主题组合式函数
 * 管理暗色/亮色模式切换
 */
export function useTheme() {
  /** 当前主题 */
  const theme = ref<Theme>(
    (localStorage.getItem('theme') as Theme) || 'system',
  )

  /**
   * 获取系统偏好主题
   * @returns 系统偏好主题
   */
  const getSystemTheme = (): 'light' | 'dark' => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  /**
   * 应用主题到DOM
   * @param targetTheme 目标主题
   */
  const applyTheme = (targetTheme: Theme) => {
    const resolved = targetTheme === 'system' ? getSystemTheme() : targetTheme
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    localStorage.setItem('theme', targetTheme)
  }

  /**
   * 设置主题
   * @param newTheme 新主题
   */
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  /**
   * 切换主题
   */
  const toggleTheme = () => {
    const current = effectiveTheme.value
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  /** 当前生效的主题（响应式） */
  const effectiveTheme = computed(() => {
    return theme.value === 'system' ? getSystemTheme() : theme.value
  })

  watch(theme, (newTheme) => {
    applyTheme(newTheme)
  })

  applyTheme(theme.value)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })

  return {
    theme,
    setTheme,
    toggleTheme,
    effectiveTheme,
  }
}

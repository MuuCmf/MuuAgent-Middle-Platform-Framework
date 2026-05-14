import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { App } from '@/api/app'

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: string
  username: string
  role: string
  isSuperAdmin: boolean
}

/**
 * 用户状态管理 Store
 * 管理用户登录状态、权限和应用上下文
 */
export const useUserStore = defineStore('user', () => {
  /**
   * 用户令牌
   */
  const token = ref<string>(localStorage.getItem('admin_token') || '')

  /**
   * 刷新令牌
   */
  const refreshToken = ref<string>(localStorage.getItem('admin_refresh_token') || '')

  /**
   * 用户信息
   */
  const userInfo = ref<UserInfo | null>(null)

  /**
   * 当前选中的应用（用于超级管理员切换应用上下文）
   */
  const currentApp = ref<App | null>(null)

  /**
   * 是否已登录
   */
  const isLoggedIn = computed(() => !!token.value)

  /**
   * 是否为超级管理员
   */
  const isSuperAdmin = computed(() => userInfo.value?.isSuperAdmin ?? false)

  /**
   * 当前应用 Code
   */
  const currentAppCode = computed(() => currentApp.value?.code ?? null)

  /**
   * 设置令牌
   * @param newToken 新令牌
   */
  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('admin_token', newToken)
  }

  /**
   * 设置刷新令牌
   * @param newRefreshToken 新刷新令牌
   */
  function setRefreshToken(newRefreshToken: string) {
    refreshToken.value = newRefreshToken
    localStorage.setItem('admin_refresh_token', newRefreshToken)
  }

  /**
   * 设置用户信息
   * @param info 用户信息
   */
  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    localStorage.setItem('admin_user', JSON.stringify(info))
  }

  /**
   * 设置当前应用
   * @param app 应用信息
   */
  function setCurrentApp(app: App | null) {
    currentApp.value = app
    if (app) {
      localStorage.setItem('current_app_code', app.code)
      localStorage.setItem('current_app', JSON.stringify(app))
    } else {
      localStorage.removeItem('current_app_code')
      localStorage.removeItem('current_app')
    }
  }

  /**
   * 从本地存储恢复用户状态
   */
  function restoreFromStorage() {
    const storedUser = localStorage.getItem('admin_user')
    if (storedUser) {
      try {
        userInfo.value = JSON.parse(storedUser)
      } catch {
        userInfo.value = null
      }
    }

    const storedApp = localStorage.getItem('current_app')
    if (storedApp) {
      try {
        currentApp.value = JSON.parse(storedApp)
      } catch {
        currentApp.value = null
      }
    }
  }

  /**
   * 清除用户状态
   */
  function clearUserState() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    currentApp.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('current_app_code')
    localStorage.removeItem('current_app')
  }

  /**
   * 初始化时从本地存储恢复状态
   */
  restoreFromStorage()

  return {
    token,
    refreshToken,
    userInfo,
    currentApp,
    isLoggedIn,
    isSuperAdmin,
    currentAppCode,
    setToken,
    setRefreshToken,
    setUserInfo,
    setCurrentApp,
    restoreFromStorage,
    clearUserState,
  }
})

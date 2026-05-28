import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { appConfig } from '@/config'
import router from '@/router'

/**
 * 内存中的令牌缓存，避免 localStorage 被清除后 router guard 误判
 */
let cachedToken: string | null = localStorage.getItem('admin_token')

/**
 * 是否正在刷新令牌
 */
let isRefreshing = false

/**
 * 是否已经跳转登录页（防止多次跳转和重复提示）
 */
let hasRedirected = false

/**
 * 等待刷新的请求队列
 */
interface RefreshSubscriber {
  resolve: (token: string) => void
  reject: (reason: unknown) => void
}
let refreshSubscribers: RefreshSubscriber[] = []

/**
 * 订阅刷新完成事件
 */
function subscribeTokenRefresh(resolve: (token: string) => void, reject: (reason: unknown) => void) {
  refreshSubscribers.push({ resolve, reject })
}

/**
 * 通知所有订阅者刷新完成
 */
function onRefreshed(token: string) {
  const subs = refreshSubscribers
  refreshSubscribers = []
  subs.forEach(sub => sub.resolve(token))
}

/**
 * 刷新失败，拒绝所有等待中的请求
 */
function onRefreshFailed() {
  const subs = refreshSubscribers
  refreshSubscribers = []
  subs.forEach(sub => sub.reject({ response: { status: 401 } }))
}

/**
 * 执行跳转登录页（确保只执行一次）
 */
function redirectToLogin() {
  if (hasRedirected) return
  hasRedirected = true
  ElMessage.error('登录已过期，请重新登录')
  router.push('/login')
}

/**
 * 重置跳转标记（登录成功后调用）
 */
export function resetRedirectFlag() {
  hasRedirected = false
}

/**
 * 清除内存中的令牌缓存（退出登录时调用）
 */
export function clearCachedToken() {
  cachedToken = null
  hasRedirected = false
}

/**
 * 刷新访问令牌
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('admin_refresh_token')

  if (!refreshToken) {
    return null
  }

  try {
    const response = await axios.post(
      `${appConfig.apiBaseUrl}/api/admin/refresh`,
      { refreshToken },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    const { accessToken, refreshToken: newRefreshToken } = response.data.data

    cachedToken = accessToken
    localStorage.setItem('admin_token', accessToken)
    localStorage.setItem('admin_refresh_token', newRefreshToken)

    return accessToken
  } catch (error: any) {
    console.error('刷新令牌失败:', error.response?.status, error.response?.data)
    cachedToken = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    return null
  }
}

/**
 * 创建共享的 401 处理逻辑
 * @returns 返回 Promise.reject 时是否需要额外处理
 */
async function handle401Error(
  error: any,
  service: AxiosInstance,
): Promise<any> {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

  // 不是 401 或已经重试过，继续抛出
  if (error.response?.status !== 401 || originalRequest._retry) {
    if (error.response?.status === 401) {
      redirectToLogin()
    }
    return Promise.reject(error)
  }

  // 已经在刷新中，加入队列等待
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(
        (token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(service(originalRequest))
        },
        (reason: unknown) => {
          reject(reason)
        },
      )
    })
  }

  // 第一个遇到 401 的请求，负责刷新令牌
  originalRequest._retry = true
  isRefreshing = true

  const newToken = await refreshAccessToken()

  if (newToken) {
    isRefreshing = false
    onRefreshed(newToken)
    originalRequest.headers.Authorization = `Bearer ${newToken}`
    return service(originalRequest)
  }

  // 刷新失败
  isRefreshing = false
  onRefreshFailed()
  redirectToLogin()
  return Promise.reject(error)
}

/**
 * 业务端请求实例（/api 前缀）
 */
const apiService: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 管理端请求实例（/api 前缀）
 */
const adminService: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 业务端请求拦截器
 */
apiService.interceptors.request.use(
  (config) => {
    const token = cachedToken || localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

/**
 * 管理端请求拦截器
 */
adminService.interceptors.request.use(
  (config) => {
    const token = cachedToken || localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const currentAppCode = localStorage.getItem('current_app_code')
    if (currentAppCode) {
      config.headers['x-app-code'] = currentAppCode
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

/**
 * 业务端响应拦截器
 */
apiService.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    return handle401Error(error, apiService).catch((e) => {
      // 非 401 的错误才在这里展示通用提示
      if (error.response?.status !== 401) {
        const message = error.response?.data?.message || error.message || '请求失败'
        ElMessage.error(message)
      }
      return Promise.reject(e)
    })
  },
)

/**
 * 管理端响应拦截器
 */
adminService.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    return handle401Error(error, adminService).catch((e) => {
      if (error.response?.status !== 401) {
        const message = error.response?.data?.message || error.message || '请求失败'
        ElMessage.error(message)
      }
      return Promise.reject(e)
    })
  },
)

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: string
}

/**
 * 业务端请求方法
 */
export const request = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiService.get(url, config)
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiService.post(url, data, config)
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiService.put(url, data, config)
  },

  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiService.patch(url, data, config)
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return apiService.delete(url, config)
  },
}

/**
 * 管理端请求方法
 */
export const adminRequest = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return adminService.get(url, config)
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return adminService.post(url, data, config)
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return adminService.put(url, data, config)
  },

  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return adminService.patch(url, data, config)
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> {
    return adminService.delete(url, config)
  },
}

export default apiService

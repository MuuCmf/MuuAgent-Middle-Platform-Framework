import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { appConfig } from '@/config'
import router from '@/router'

/**
 * 是否正在刷新令牌
 */
let isRefreshing = false

/**
 * 等待刷新的请求队列
 */
let refreshSubscribers: Array<(token: string) => void> = []

/**
 * 订阅刷新完成事件
 * @param callback 回调函数
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

/**
 * 通知所有订阅者刷新完成
 * @param token 新令牌
 */
function onRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

/**
 * 刷新令牌失败，清除所有订阅
 */
function onRefreshFailed() {
  refreshSubscribers = []
}

/**
 * 刷新访问令牌
 * @returns {Promise<string | null>} 新的访问令牌
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('admin_refresh_token')
  
  if (!refreshToken) {
    return null
  }
  
  try {
    const response = await axios.post(
      `${appConfig.apiBaseUrl}api/admin/refresh`,
      { refreshToken },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    
    const { accessToken, refreshToken: newRefreshToken } = response.data.data
    
    localStorage.setItem('admin_token', accessToken)
    localStorage.setItem('admin_refresh_token', newRefreshToken)
    
    return accessToken
  } catch (error) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    localStorage.removeItem('admin_user')
    return null
  }
}

/**
 * 业务端请求实例（/api 前缀）
 */
const apiService: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * 管理端请求实例（/api 前缀）
 */
const adminService: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * 业务端请求拦截器
 */
apiService.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (appConfig.apiKey) {
      config.headers['x-api-key'] = appConfig.apiKey
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 管理端请求拦截器
 */
adminService.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (appConfig.apiKey) {
      config.headers['x-api-key'] = appConfig.apiKey
    }
    
    const currentAppCode = localStorage.getItem('current_app_code')
    if (currentAppCode) {
      config.headers['x-app-code'] = currentAppCode
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 业务端响应拦截器
 */
apiService.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiService(originalRequest))
          })
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      const newToken = await refreshAccessToken()
      
      if (newToken) {
        onRefreshed(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiService(originalRequest)
      } else {
        onRefreshFailed()
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login')
        return Promise.reject(error)
      }
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_refresh_token')
      localStorage.removeItem('admin_user')
      ElMessage.error('登录已过期，请重新登录')
      router.push('/login')
      return Promise.reject(error)
    }
    
    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

/**
 * 管理端响应拦截器
 */
adminService.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(adminService(originalRequest))
          })
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      const newToken = await refreshAccessToken()
      
      if (newToken) {
        onRefreshed(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return adminService(originalRequest)
      } else {
        onRefreshFailed()
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login')
        return Promise.reject(error)
      }
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_refresh_token')
      localStorage.removeItem('admin_user')
      ElMessage.error('登录已过期，请重新登录')
      router.push('/login')
      return Promise.reject(error)
    }
    
    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
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
  }
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
  }
}

export default apiService

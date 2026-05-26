import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { API_CONFIG } from '../api/config'
import { getApiKey, getUid } from './auth'
import { apiKeyDialogState } from './events'

/**
 * API 响应结构
 */
interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
  timestamp: string
}

class HttpClient {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        config.headers['x-api-key'] = getApiKey()
        config.headers['x-uid'] = getUid()

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        const { data } = response

        /** 检查业务错误码 */
        if (data.code === 2000) {
          /** 无效的 API 密钥 - 防重复显示 */
          if (!apiKeyDialogState.isShowing) {
            ElMessage.error(data.message || '无效的API密钥')
            apiKeyDialogState.open()
          }
          return Promise.reject(new Error(data.message || '无效的API密钥'))
        }

        return response
      },
      (error) => {
        console.error('API Error:', error)

        /** 处理 HTTP 错误 */
        if (error.response) {
          const { status, data } = error.response
          const message = data?.message || '请求失败'

          if (status === 401) {
            /** 认证失败 - 防重复显示 */
            if (!apiKeyDialogState.isShowing) {
              ElMessage.error('认证失败，请检查 API Key')
              apiKeyDialogState.open()
            }
          } else {
            ElMessage.error(message)
          }
        } else if (error.request) {
          ElMessage.error('网络错误，请检查网络连接')
        } else {
          ElMessage.error(error.message || '请求失败')
        }

        return Promise.reject(error)
      }
    )
  }

  getInstance(): AxiosInstance {
    return this.instance
  }
}

export const httpClient = new HttpClient()
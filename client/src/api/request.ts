import axios, { type AxiosInstance } from 'axios'
import { API_CONFIG } from './config'

/**
 * HTTP客户端类
 */
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

  /**
   * 设置拦截器
   */
  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        config.headers['x-api-key'] = 'AI-SVC-2026-MCP-KEY-666'
        
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * 获取axios实例
   */
  getInstance(): AxiosInstance {
    return this.instance
  }
}

export const httpClient = new HttpClient()

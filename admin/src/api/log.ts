import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface Log {
  id: string
  modelId?: string
  modelCode: string
  modelType: string
  request: string
  response?: string
  costMs: number
  inputTokens?: number
  outputTokens?: number
  success: boolean
  errorMessage?: string
  clientIp?: string
  userAgent?: string
  createdAt: string
  model?: {
    id: string
    name: string
    code: string
    provider: string
    type?: string
  }
}

export interface Statistics {
  ai?: {
    total: number
    successRate: number
  }
  skill?: {
    total: number
  }
  agent?: {
    total: number
  }
  modelTypeStats: Array<{
    modelType: string
    count: number
  }>
  modelStats: Array<{
    modelCode: string
    count: number
    avgCostMs: number
  }>
}

export const logApi = {
  /**
   * 获取AI调用日志列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 日志列表响应
   */
  getAiLogs(params?: {
    modelId?: string
    modelCode?: string
    modelType?: string
    success?: boolean
    startTime?: string
    endTime?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<{ data: { list: Log[]; total: number; page: number; pageSize: number } }>> {
    return adminRequest.get('/admin/log/ai', { params })
  },

  /**
   * 获取单个AI调用日志详情
   * @param id 日志ID
   * @returns {Promise<AxiosResponse>} 日志详情响应
   */
  getAiLogById(id: string): Promise<AxiosResponse<{ data: Log }>> {
    return adminRequest.get(`/admin/log/ai/${id}`)
  },

  /**
   * 获取调用统计
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns {Promise<AxiosResponse>} 统计数据响应
   */
  getStatistics(startTime?: string, endTime?: string): Promise<AxiosResponse<{ data: Statistics }>> {
    return adminRequest.get('/admin/log/statistics', {
      params: { startTime, endTime },
    })
  },
}

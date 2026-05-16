import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 路由日志
 */
export interface IntentRoutingLog {
  id: number
  userMessage: string
  detectedIntent: string
  confidence: number
  source: string
  selectedModelId?: number
  selectedModelCode?: string
  modelType?: string
  isDegraded: boolean
  degradeReason?: string
  costMs: number
  success: boolean
  errorMessage?: string
  clientIp?: string
  uid?: string
  appCode?: string
  createdAt: string
}

/**
 * 路由日志统计
 */
export interface RoutingLogStats {
  total: number
  successRate: number
  avgCostMs: number
  degradeRate: number
}

/**
 * 路由日志列表响应
 */
export interface IntentRoutingLogListResponse {
  list: IntentRoutingLog[]
  total: number
}

export const intentRoutingLogApi = {
  /**
   * 获取路由日志列表
   */
  getList(params?: {
    intent?: string
    modelCode?: string
    modelType?: string
    source?: string
    isDegraded?: boolean
    success?: boolean
    appCode?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<ApiResponse<IntentRoutingLogListResponse>>> {
    return adminRequest.get('api/admin/intent-routing-log', { params })
  },

  /**
   * 获取日志详情
   */
  getById(id: number): Promise<AxiosResponse<ApiResponse<IntentRoutingLog>>> {
    return adminRequest.get(`api/admin/intent-routing-log/${id}`)
  },

  /**
   * 获取日志统计
   */
  getStats(params?: {
    startDate?: string
    endDate?: string
    appCode?: string
  }): Promise<AxiosResponse<ApiResponse<RoutingLogStats>>> {
    return adminRequest.get('api/admin/intent-routing-log/stats', { params })
  }
}
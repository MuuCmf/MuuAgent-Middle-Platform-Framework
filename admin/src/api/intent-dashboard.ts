import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 看板概览数据
 */
export interface DashboardOverview {
  totalRequests: number
  successRate: number
  avgCostMs: number
  degradeRate: number
  intentDistribution: Array<{
    intent: string
    count: number
    percentage: number
  }>
  modelUsage: Array<{
    modelCode: string
    count: number
    percentage: number
  }>
  degradeReasons: Array<{
    reason: string
    count: number
  }>
}

/**
 * 趋势数据点
 */
export interface TrendPoint {
  time: string
  count: number
  successCount: number
  failCount: number
  avgCostMs: number
}

/**
 * 意图分布
 */
export interface IntentDistribution {
  intent: string
  count: number
  percentage: number
}

/**
 * 模型使用排行
 */
export interface ModelUsageRank {
  modelCode: string
  modelName: string
  count: number
  percentage: number
  successRate: number
  avgCostMs: number
}

/**
 * 降级统计
 */
export interface DegradeStat {
  reason: string
  count: number
  percentage: number
}

export const intentDashboardApi = {
  /**
   * 获取看板概览
   */
  getOverview(params?: {
    startDate?: string
    endDate?: string
    appCode?: string
  }): Promise<AxiosResponse<ApiResponse<DashboardOverview>>> {
    return adminRequest.get('api/admin/intent-dashboard/overview', { params })
  },

  /**
   * 获取趋势数据
   */
  getTrend(params: {
    startDate?: string
    endDate?: string
    granularity?: 'hour' | 'day'
    intent?: string
  }): Promise<AxiosResponse<ApiResponse<TrendPoint[]>>> {
    return adminRequest.get('api/admin/intent-dashboard/trend', { params })
  },

  /**
   * 获取意图分布
   */
  getIntentDistribution(params?: {
    startDate?: string
    endDate?: string
  }): Promise<AxiosResponse<ApiResponse<IntentDistribution[]>>> {
    return adminRequest.get('api/admin/intent-dashboard/intent-distribution', { params })
  },

  /**
   * 获取模型使用排行
   */
  getModelUsage(params?: {
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<AxiosResponse<ApiResponse<ModelUsageRank[]>>> {
    return adminRequest.get('api/admin/intent-dashboard/model-usage', { params })
  },

  /**
   * 获取降级统计
   */
  getDegradeStats(params?: {
    startDate?: string
    endDate?: string
  }): Promise<AxiosResponse<ApiResponse<DegradeStat[]>>> {
    return adminRequest.get('api/admin/intent-dashboard/degrade-stats', { params })
  }
}
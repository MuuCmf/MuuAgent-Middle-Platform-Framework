import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 意图缓存条目
 */
export interface IntentCacheItem {
  id: number
  intent: string
  source: string
  userMessage: string
  messageHash: string
  result: string
  confidence: number
  hitCount: number
  lastHitAt: string
  createdAt: string
  updatedAt: string
}

/**
 * 缓存统计
 */
export interface CacheStats {
  total: number
  totalHits: number
  byIntent: Record<string, number>
  bySource: Record<string, number>
}

/**
 * 缓存列表响应
 */
export interface IntentCacheListResponse {
  list: IntentCacheItem[]
  total: number
}

export const intentCacheApi = {
  /**
   * 获取缓存列表
   */
  getList(params?: {
    intent?: string
    source?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<ApiResponse<IntentCacheListResponse>>> {
    return adminRequest.get('api/admin/intent-cache', { params })
  },

  /**
   * 清除指定缓存
   */
  clear(params?: {
    intent?: string
    source?: string
  }): Promise<AxiosResponse<ApiResponse<{ cleared: number }>>> {
    return adminRequest.delete('api/admin/intent-cache/clear', { params })
  },

  /**
   * 清除所有缓存
   */
  clearAll(): Promise<AxiosResponse<ApiResponse<{ cleared: number }>>> {
    return adminRequest.delete('api/admin/intent-cache/clear-all')
  },

  /**
   * 获取缓存统计
   */
  getStats(): Promise<AxiosResponse<ApiResponse<CacheStats>>> {
    return adminRequest.get('api/admin/intent-cache/stats')
  }
}
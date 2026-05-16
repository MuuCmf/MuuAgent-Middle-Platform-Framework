import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 意图关键词
 */
export interface IntentKeyword {
  id: number
  intent: string
  keyword: string
  weight: number
  isRegex: boolean
  status: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

/**
 * 关键词表单
 */
export interface IntentKeywordForm {
  intent: string
  keyword: string
  weight?: number
  isRegex?: boolean
  status?: boolean
  description?: string
}

/**
 * 批量导入表单
 */
export interface BatchImportForm {
  keywords: IntentKeywordForm[]
}

/**
 * 批量导入结果
 */
export interface BatchImportResult {
  created: number
  skipped: number
}

/**
 * 关键词统计
 */
export interface KeywordStats {
  total: number
  enabled: number
  disabled: number
  byIntent: Record<string, number>
}

/**
 * 意图关键词列表响应
 */
export interface IntentKeywordListResponse {
  list: IntentKeyword[]
  total: number
}

export const intentKeywordApi = {
  /**
   * 获取关键词列表
   */
  getList(params?: {
    intent?: string
    status?: boolean
    keyword?: string
    page?: number
    pageSize?: number
  }): Promise<AxiosResponse<ApiResponse<IntentKeywordListResponse>>> {
    return adminRequest.get('api/admin/intent-keyword', { params })
  },

  /**
   * 获取关键词详情
   */
  getById(id: number): Promise<AxiosResponse<ApiResponse<IntentKeyword>>> {
    return adminRequest.get(`api/admin/intent-keyword/${id}`)
  },

  /**
   * 创建关键词
   */
  create(data: IntentKeywordForm): Promise<AxiosResponse<ApiResponse<IntentKeyword>>> {
    return adminRequest.post('api/admin/intent-keyword', data)
  },

  /**
   * 更新关键词
   */
  update(id: number, data: Partial<IntentKeywordForm>): Promise<AxiosResponse<ApiResponse<IntentKeyword>>> {
    return adminRequest.put(`api/admin/intent-keyword/${id}`, data)
  },

  /**
   * 删除关键词
   */
  delete(id: number): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`api/admin/intent-keyword/${id}`)
  },

  /**
   * 批量导入关键词
   */
  batchImport(data: BatchImportForm): Promise<AxiosResponse<ApiResponse<BatchImportResult>>> {
    return adminRequest.post('api/admin/intent-keyword/batch-import', data)
  },

  /**
   * 切换关键词状态
   */
  toggleStatus(id: number, status: boolean): Promise<AxiosResponse<ApiResponse<IntentKeyword>>> {
    return adminRequest.put(`api/admin/intent-keyword/${id}/toggle-status`, { status })
  },

  /**
   * 获取关键词统计
   */
  getStats(): Promise<AxiosResponse<ApiResponse<KeywordStats>>> {
    return adminRequest.get('api/admin/intent-keyword/stats')
  }
}
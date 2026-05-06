import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 知识库信息
 */
export interface KbInfo {
  kbId: string
  kbName: string
  kbCode: string
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number
  similarityThresh: number
  topN: number
  isPublic: boolean
  status: boolean
  description: string
  createdBy: string
  createdTime: string
  documentCount?: number
  chunkCount?: number
}

/**
 * 知识库列表响应
 */
export interface KbListResponse {
  list: KbInfo[]
  total: number
}

/**
 * 知识库API
 */
export const kbApi = {
  /**
   * 获取知识库列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 知识库列表
   */
  getList(params?: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    status?: boolean
  }): Promise<AxiosResponse<ApiResponse<KbListResponse>>> {
    return adminRequest.get('/admin/kb', { params })
  },

  /**
   * 获取知识库详情
   * @param kbId 知识库ID
   * @returns {Promise<AxiosResponse>} 知识库详情
   */
  getDetail(kbId: string): Promise<AxiosResponse<ApiResponse<KbInfo>>> {
    return adminRequest.get(`/admin/kb/${kbId}`)
  },

  /**
   * 创建知识库
   * @param data 创建参数
   * @returns {Promise<AxiosResponse>} 创建结果
   */
  create(data: {
    uid?: string
    kbName: string
    kbCode: string
    embeddingModel?: string
    chunkSize?: number
    chunkOverlap?: number
    similarityThresh?: number
    topN?: number
    description?: string
  }): Promise<AxiosResponse<ApiResponse<{ kbId: string }>>> {
    return adminRequest.post('/admin/kb', data)
  },

  /**
   * 更新知识库
   * @param data 更新参数
   * @returns {Promise<AxiosResponse>} 更新结果
   */
  update(data: {
    uid?: string
    kbId: string
    kbName?: string
    embeddingModel?: string
    chunkSize?: number
    chunkOverlap?: number
    similarityThresh?: number
    topN?: number
    description?: string
    status?: boolean
  }): Promise<AxiosResponse<ApiResponse<boolean>>> {
    return adminRequest.put('/admin/kb', data)
  },

  /**
   * 删除知识库
   * @param uid 用户ID
   * @param kbId 知识库ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  delete(uid: string, kbId: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/kb/${kbId}`, { data: { uid } })
  }
}

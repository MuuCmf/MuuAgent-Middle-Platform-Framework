import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 文档信息
 */
export interface DocumentInfo {
  docId: string
  kbId: string
  docName: string
  docCode: string
  fileType: string
  fileUrl: string
  fileSizeKb: number
  status: number
  totalChunks: number
  createdBy: string
  createdTime: string
}

/**
 * 文档列表响应
 */
export interface DocumentListResponse {
  list: DocumentInfo[]
  total: number
}

/**
 * 文档API
 */
export const documentApi = {
  /**
   * 上传文档
   * @param uid 用户ID
   * @param kbId 知识库ID
   * @param file 文件
   * @returns {Promise<AxiosResponse>} 上传结果
   */
  upload(uid: string, kbId: string, file: File): Promise<AxiosResponse<{ data: DocumentInfo }>> {
    const formData = new FormData()
    formData.append('uid', uid)
    formData.append('kbId', kbId)
    formData.append('file', file)
    
    return request.post('/admin/kb/document/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  /**
   * 获取文档列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 文档列表
   */
  getList(params: {
    kbId: string
    pageNum?: number
    pageSize?: number
    docName?: string
  }): Promise<AxiosResponse<{ data: DocumentListResponse }>> {
    return request.get('/admin/kb/document/list', { params })
  },

  /**
   * 删除文档
   * @param uid 用户ID
   * @param kbId 知识库ID
   * @param docId 文档ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  delete(uid: string, kbId: string, docId: string): Promise<AxiosResponse<{ data: boolean }>> {
    return request.post('/admin/kb/document/delete', { uid, kbId, docId })
  }
}

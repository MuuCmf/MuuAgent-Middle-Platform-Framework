import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 文档信息
 */
export interface DocumentInfo {
  docId: string
  docCode: string
  fileId: string
  fileName: string
  fileType: string
  fileUrl: string
  fileSize: number
  status: number
  totalChunks: number
  isDuplicate?: boolean
  createdBy: string
  createdTime: string
}

/**
 * 文档列表响应
 */
export interface DocumentListResponse {
  list: DocumentInfo[]
  total: number
  pageNum: number
  pageSize: number
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
   * @param appCode 应用标识
   * @returns {Promise<AxiosResponse>} 上传结果
   */
  upload(uid: string, kbId: string, file: File, appCode?: string): Promise<AxiosResponse<{ data: DocumentInfo }>> {
    const formData = new FormData()
    formData.append('uid', uid)
    formData.append('kbId', kbId)
    formData.append('file', file)
    if (appCode) {
      formData.append('appCode', appCode)
    }
    
    return request.post('api/admin/kb/document/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  /**
   * 批量上传文档
   * @param uid 用户ID
   * @param kbId 知识库ID
   * @param files 文件列表
   * @param appCode 应用标识
   * @returns {Promise<AxiosResponse>} 上传结果
   */
  batchUpload(uid: string, kbId: string, files: File[], appCode?: string): Promise<AxiosResponse<{ data: DocumentInfo[] }>> {
    const formData = new FormData()
    formData.append('uid', uid)
    formData.append('kbId', kbId)
    files.forEach(file => {
      formData.append('files', file)
    })
    if (appCode) {
      formData.append('appCode', appCode)
    }
    
    return request.post('api/admin/kb/document/batch-upload', formData, {
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
    return request.get('api/admin/kb/document/list', { params })
  },

  /**
   * 删除文档
   * @param uid 用户ID
   * @param kbId 知识库ID
   * @param docId 文档ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  delete(uid: string, kbId: string, docId: string): Promise<AxiosResponse<{ data: boolean }>> {
    return request.post('api/admin/kb/document/delete', { uid, kbId, docId })
  }
}

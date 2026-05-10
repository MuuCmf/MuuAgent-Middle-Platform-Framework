import { httpClient } from './request'

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
  retrievalMethod: string
  isPublic: boolean
  status: boolean
  description: string
  createdTime: string
  documentCount?: number
  chunkCount?: number
}

/**
 * 知识库API
 */
export const kbApi = {
  /**
   * 获取启用的知识库列表
   * @param params 查询参数
   * @returns {Promise<any>} 知识库列表
   */
  async getList(params?: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    status?: boolean
  }): Promise<{ data: KbInfo[] }> {
    const response = await httpClient.getInstance().get('/api/kb', { params })
    return { data: response.data.data }
  },

  /**
   * 获取知识库详情
   * @param kbId 知识库ID
   * @returns {Promise<any>} 知识库详情
   */
  async getDetail(kbId: string): Promise<{ data: KbInfo }> {
    const response = await httpClient.getInstance().get(`/api/kb/${kbId}`)
    return { data: response.data.data }
  },
}

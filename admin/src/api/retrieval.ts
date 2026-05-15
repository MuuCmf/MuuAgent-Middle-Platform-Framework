import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 检索结果项
 */
export interface RetrievalItem {
  // 检索结果项的唯一标识符
  chunkId: string
  // 检索结果项的内容
  content: string
  // 检索结果项的相似度分数
  // 越高表示越相关
  score: number
  // 检索结果项所属的文档名称
  docName: string
  // 检索结果项所属的文档唯一标识符
  docId: string
  // 检索结果项的元数据
  metadata?: any
}

/**
 * 检索响应
 * 包含检索结果项、查询、知识库ID和总结果数
 */
export interface RetrievalResponse {
  // 检索结果项列表
  list: RetrievalItem[]
  // 检索查询的文本
  query: string
  // 知识库的唯一标识符
  kbId: string
  // 总结果数
  total: number
}

/**
 * 检索API
 */
export const retrievalApi = {
  /**
   * 向量检索
   * @param data 检索参数
   * @returns {Promise<AxiosResponse>} 检索结果
   */
  retrieval(data: {
    kbId: string
    query: string
    topN?: number
    similarityThresh?: number
  }): Promise<AxiosResponse<{ data: RetrievalResponse }>> {
    return request.post('api/kb/retrieval', data)
  }
}

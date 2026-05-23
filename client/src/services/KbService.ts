import { httpClient } from '../utils/request'

/**
 * 知识库信息接口
 */
export interface KbInfo {
  /** 知识库ID */
  kbId: string
  /** 知识库名称 */
  kbName: string
  /** 知识库代码 */
  kbCode: string
  /** 嵌入模型 */
  embeddingModel: string
  /** 分块大小 */
  chunkSize: number
  /** 分块重叠 */
  chunkOverlap: number
  /** 相似度阈值 */
  similarityThresh: number
  /** 返回数量 */
  topN: number
  /** 检索方式 */
  retrievalMethod: string
  /** 是否公开 */
  isPublic: boolean
  /** 状态 */
  status: boolean
  /** 描述 */
  description: string
  /** 创建时间 */
  createdTime: string
  /** 文档数量 */
  documentCount?: number
  /** 分块数量 */
  chunkCount?: number
}

/**
 * 知识库服务
 * 封装知识库相关的API调用
 */
export class KbService {
  /**
   * 获取知识库列表
   * @param params 查询参数
   * @returns 知识库列表
   */
  async getList(params?: {
    /** 页码 */
    pageNum?: number
    /** 每页数量 */
    pageSize?: number
    /** 关键词 */
    keyword?: string
    /** 状态 */
    status?: boolean
  }): Promise<{ data: KbInfo[] }> {
    const response = await httpClient.getInstance().get('/api/kb', { params })
    return { data: response.data.data }
  }

  /**
   * 获取知识库详情
   * @param kbId 知识库ID
   * @returns 知识库详情
   */
  async getDetail(kbId: string): Promise<{ data: KbInfo }> {
    const response = await httpClient.getInstance().get(`/api/kb/${kbId}`)
    return { data: response.data.data }
  }
}

/** 知识库服务实例 */
export const kbService = new KbService()

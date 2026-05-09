import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * Prompt 模板接口定义
 */
export interface PromptTemplate {
  id: string
  code: string
  name: string
  category: string
  content: string
  variables?: string
  version: number
  isDefault: boolean
  status: boolean
  description?: string
  tags?: string
  metadata?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * Prompt 模板表单数据
 */
export interface PromptTemplateForm {
  name: string
  code: string
  category: string
  content: string
  variables?: VariableDefinition[]
  isDefault?: boolean
  status?: boolean
  description?: string
  tags?: string[]
  metadata?: Record<string, any>
  createdBy?: string
}

/**
 * 变量定义接口
 */
export interface VariableDefinition {
  name: string
  type: string
  required: boolean
  description?: string
  defaultValue?: any
}

/**
 * 查询参数接口
 */
export interface QueryPromptTemplateParams {
  page?: number
  pageSize?: number
  category?: string
  status?: boolean
  keyword?: string
}

/**
 * 列表响应接口
 */
export interface PromptTemplateListResponse {
  list: PromptTemplate[]
  total: number
  page: number
  pageSize: number
}

/**
 * 渲染请求接口
 */
export interface RenderPromptTemplateRequest {
  code: string
  variables: Record<string, any>
}

/**
 * 渲染响应接口
 */
export interface RenderPromptTemplateResponse {
  renderedPrompt: string
}

/**
 * 版本历史接口
 */
export interface PromptVersion {
  id: string
  templateId: string
  version: number
  content: string
  variables?: string
  changeLog?: string
  changeType: string
  createdBy?: string
  createdAt: string
}

/**
 * 回滚请求接口
 */
export interface RollbackPromptTemplateRequest {
  changeLog?: string
}

/**
 * Prompt 模板 API
 */
export const promptTemplateApi = {
  /**
   * 创建 Prompt 模板
   * @param data 模板数据
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 创建的模板
   */
  create(data: PromptTemplateForm): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.post('/admin/prompt-template', data)
  },

  /**
   * 更新 Prompt 模板
   * @param code 模板标识
   * @param data 更新数据
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 更新后的模板
   */
  update(code: string, data: Partial<PromptTemplateForm>): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.put(`/admin/prompt-template/${code}`, data)
  },

  /**
   * 删除 Prompt 模板
   * @param id 模板ID
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>}
   */
  delete(id: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/prompt-template/${id}`)
  },

  /**
   * 查询 Prompt 模板详情
   * @param id 模板ID
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 模板详情
   */
  findOne(id: string): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.get(`/admin/prompt-template/${id}`)
  },

  /**
   * 根据标识查询 Prompt 模板
   * @param code 模板标识
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 模板详情
   */
  findByCode(code: string): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.get(`/admin/prompt-template/code/${code}`)
  },

  /**
   * 查询 Prompt 模板列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplateListResponse>>>} 模板列表
   */
  findAll(params?: QueryPromptTemplateParams): Promise<AxiosResponse<ApiResponse<PromptTemplateListResponse>>> {
    return adminRequest.get('/admin/prompt-template', { params })
  },

  /**
   * 渲染 Prompt 模板
   * @param data 渲染请求数据
   * @returns {Promise<AxiosResponse<ApiResponse<RenderPromptTemplateResponse>>>} 渲染结果
   */
  render(data: RenderPromptTemplateRequest): Promise<AxiosResponse<ApiResponse<RenderPromptTemplateResponse>>> {
    return adminRequest.post('/admin/prompt-template/render', data)
  },

  /**
   * 获取版本历史
   * @param id 模板ID
   * @param limit 限制数量
   * @returns {Promise<AxiosResponse<ApiResponse<PromptVersion[]>>>} 版本历史列表
   */
  getVersionHistory(id: string, limit?: number): Promise<AxiosResponse<ApiResponse<PromptVersion[]>>> {
    return adminRequest.get(`/admin/prompt-template/${id}/versions`, {
      params: { limit }
    })
  },

  /**
   * 版本回滚
   * @param id 模板ID
   * @param version 版本号
   * @param data 回滚数据
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 回滚后的模板
   */
  rollback(id: string, version: number, data?: RollbackPromptTemplateRequest): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.post(`/admin/prompt-template/${id}/rollback/${version}`, data)
  },

  /**
   * 设置默认模板
   * @param id 模板ID
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 更新后的模板
   */
  setDefault(id: string): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.post(`/admin/prompt-template/${id}/set-default`)
  },

  /**
   * 获取分类的默认模板
   * @param category 分类
   * @returns {Promise<AxiosResponse<ApiResponse<PromptTemplate>>>} 默认模板
   */
  getDefaultTemplate(category: string): Promise<AxiosResponse<ApiResponse<PromptTemplate>>> {
    return adminRequest.get(`/admin/prompt-template/default/${category}`)
  }
}

import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 应用信息接口
 */
export interface App {
  id: string
  name: string
  code: string
  apiKey: string
  secretKey: string
  qpsLimit: number
  dailyLimit: number
  tokenLimit: number
  enableOAuth: boolean
  status: boolean
  expireAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 应用表单接口
 */
export interface AppForm {
  name: string
  code: string
  qpsLimit?: number
  dailyLimit?: number
  tokenLimit?: number
  enableOAuth?: boolean
  status?: boolean
  expireAt?: string
}

/**
 * 应用列表查询参数
 */
export interface AppQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: boolean
}

/**
 * 应用列表响应
 */
export interface AppListResponse {
  list: App[]
  total: number
  page: number
  pageSize: number
}

/**
 * 应用使用统计
 */
export interface AppUsage {
  /** 智能体数量 */
  agentCount: number
  /** 技能数量 */
  skillCount: number
  /** 知识库数量 */
  kbCount: number
  /** 今日调用次数 */
  todayCalls: number
  /** 今日Token用量 */
  todayTokens: number
  /** 今日输入Token用量 */
  todayInputTokens: number
  /** 今日输出Token用量 */
  todayOutputTokens: number
  /** 本月调用次数 */
  monthCalls: number
  /** 本月Token用量 */
  monthTokens: number
  /** 本月输入Token用量 */
  monthInputTokens: number
  /** 本月输出Token用量 */
  monthOutputTokens: number
  /** 每日调用限制 */
  dailyLimit: number
  /** Token配额 */
  tokenLimit: number
}

/**
 * 重置密钥响应
 */
export interface ResetSecretResponse {
  id: string
  apiKey: string
  secretKey: string
}

/**
 * 应用管理 API
 */
export const appApi = {
  /**
   * 获取应用列表
   * @param query 查询参数
   * @returns {Promise<AxiosResponse<ApiResponse<AppListResponse>>>} 应用列表
   */
  getList(query?: AppQuery): Promise<AxiosResponse<ApiResponse<AppListResponse>>> {
    return adminRequest.get('/admin/apps', { params: query })
  },

  /**
   * 获取应用详情
   * @param id 应用ID
   * @returns {Promise<AxiosResponse<ApiResponse<App>>>} 应用详情
   */
  getOne(id: string): Promise<AxiosResponse<ApiResponse<App>>> {
    return adminRequest.get(`/admin/apps/${id}`)
  },

  /**
   * 创建应用
   * @param data 应用数据
   * @returns {Promise<AxiosResponse<ApiResponse<App>>>} 创建结果
   */
  create(data: AppForm): Promise<AxiosResponse<ApiResponse<App>>> {
    return adminRequest.post('/admin/apps', data)
  },

  /**
   * 更新应用
   * @param id 应用ID
   * @param data 应用数据
   * @returns {Promise<AxiosResponse<ApiResponse<App>>>} 更新结果
   */
  update(id: string, data: Partial<AppForm>): Promise<AxiosResponse<ApiResponse<App>>> {
    return adminRequest.put(`/admin/apps/${id}`, data)
  },

  /**
   * 删除应用
   * @param id 应用ID
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>} 删除结果
   */
  delete(id: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/apps/${id}`)
  },

  /**
   * 重置应用密钥
   * @param id 应用ID
   * @param resetApiKey 是否同时重置API Key
   * @returns {Promise<AxiosResponse<ApiResponse<ResetSecretResponse>>>} 新密钥
   */
  resetSecret(id: string, resetApiKey?: boolean): Promise<AxiosResponse<ApiResponse<ResetSecretResponse>>> {
    return adminRequest.post(`/admin/apps/${id}/reset-secret`, { resetApiKey })
  },

  /**
   * 获取应用使用统计
   * @param id 应用ID
   * @returns {Promise<AxiosResponse<ApiResponse<AppUsage>>>} 使用统计
   */
  getUsage(id: string): Promise<AxiosResponse<ApiResponse<AppUsage>>> {
    return adminRequest.get(`/admin/apps/${id}/usage`)
  },
}

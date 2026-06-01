import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * OAuth客户端接口
 */
export interface OAuthClient {
  id: string
  clientId: string
  clientSecret?: string
  name: string
  redirectUris: string[]
  scopes: string[]
  grants: string[]
  appCode?: string
  status: number
  createdAt: string
  updatedAt: string
  tokenCount?: number
}

/**
 * 创建客户端请求参数
 */
export interface CreateClientDto {
  name: string;
  scopes: string[];
  grants?: string[];
  appCode?: string;
}

/**
 * 更新客户端请求参数
 */
export interface UpdateClientDto {
  name?: string
  scopes?: string[]
  grants?: string[]
  status?: number
}

/**
 * OAuth令牌接口
 */
export interface OAuthToken {
  id: string
  accessToken: string
  clientId: string
  clientName: string
  userId: string
  scope: string
  expiresAt: string
  createdAt: string
}

/**
 * 客户端列表响应
 */
export interface ClientListResponse {
  total: number
  page: number
  pageSize: number
  data: OAuthClient[]
}

/**
 * 令牌列表响应
 */
export interface TokenListResponse {
  total: number
  page: number
  pageSize: number
  data: OAuthToken[]
}

export const oauthApi = {
  /**
   * 获取客户端列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param search 搜索关键词
   * @param appCode 应用标识
   * @returns {Promise<AxiosResponse>} 客户端列表响应
   */
  getClients(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
    appCode?: string
  ): Promise<AxiosResponse<ApiResponse<ClientListResponse>>> {
    const params: any = { page, pageSize }
    if (search) params.search = search
    if (appCode) params.appCode = appCode
    return adminRequest.get<ClientListResponse>('api/admin/oauth/clients', { params })
  },

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<AxiosResponse>} 客户端详情响应
   */
  getClient(id: string): Promise<AxiosResponse<ApiResponse<OAuthClient>>> {
    return adminRequest.get<OAuthClient>(`api/admin/oauth/clients/${id}`)
  },

  /**
   * 创建客户端
   * @param data 创建客户端数据
   * @returns {Promise<AxiosResponse>} 创建结果
   */
  createClient(data: CreateClientDto): Promise<AxiosResponse<ApiResponse<OAuthClient>>> {
    return adminRequest.post<OAuthClient>('api/admin/oauth/clients', data)
  },

  /**
   * 更新客户端
   * @param id 客户端ID
   * @param data 更新客户端数据
   * @returns {Promise<AxiosResponse>} 更新结果
   */
  updateClient(id: string, data: UpdateClientDto): Promise<AxiosResponse<ApiResponse<OAuthClient>>> {
    return adminRequest.put<OAuthClient>(`api/admin/oauth/clients/${id}`, data)
  },

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  deleteClient(id: string): Promise<AxiosResponse<ApiResponse<{ message: string }>>> {
    return adminRequest.delete<{ message: string }>(`api/admin/oauth/clients/${id}`)
  },

  /**
   * 重置客户端密钥
   * @param id 客户端ID
   * @returns {Promise<AxiosResponse>} 新的客户端密钥
   */
  resetClientSecret(
    id: string
  ): Promise<AxiosResponse<ApiResponse<{ clientId: string; clientSecret: string }>>> {
    return adminRequest.post<{ clientId: string; clientSecret: string }>(`api/admin/oauth/clients/${id}/reset-secret`)
  },

  /**
   * 获取令牌列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param clientId 客户端ID（可选）
   * @returns {Promise<AxiosResponse>} 令牌列表响应
   */
  getTokens(
    page: number = 1,
    pageSize: number = 10,
    clientId?: string
  ): Promise<AxiosResponse<ApiResponse<TokenListResponse>>> {
    const params: any = { page, pageSize }
    if (clientId) params.clientId = clientId
    return adminRequest.get<TokenListResponse>('api/admin/oauth/tokens', { params })
  },

  /**
   * 撤销令牌
   * @param id 令牌ID
   * @returns {Promise<AxiosResponse>} 撤销结果
   */
  revokeToken(id: string): Promise<AxiosResponse<ApiResponse<{ message: string }>>> {
    return adminRequest.post<{ message: string }>(`api/admin/oauth/tokens/${id}/revoke`)
  },
}

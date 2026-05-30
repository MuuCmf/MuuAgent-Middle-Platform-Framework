import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 管理员信息接口
 */
export interface AdminUser {
  id: string
  username: string
  nickname?: string
  email?: string
  phone?: string
  role: string
  isSuperAdmin: boolean
  status: number
  lastLoginAt?: string
  lastLoginIp?: string
  createdAt: string
  updatedAt: string
}

/**
 * 管理员列表查询参数
 */
export interface AdminQuery {
  page?: number
  pageSize?: number
  keyword?: string
  role?: string
  status?: number
}

/**
 * 管理员列表响应
 */
export interface AdminListResponse {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}

/**
 * 创建管理员表单
 */
export interface CreateAdminForm {
  username: string
  password: string
  nickname?: string
  email?: string
  phone?: string
  role?: string
}

/**
 * 更新管理员表单
 */
export interface UpdateAdminForm {
  nickname?: string
  email?: string
  phone?: string
  role?: string
}

/**
 * 重置密码表单
 */
export interface ResetPasswordForm {
  newPassword: string
}

/**
 * 修改密码表单
 */
export interface ChangePasswordForm {
  oldPassword: string
  newPassword: string
}

/**
 * 登录表单
 */
export interface LoginForm {
  username: string
  password: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  admin: AdminUser
}

/**
 * 管理员管理 API
 */
export const adminApi = {
  /**
   * 管理员登录
   * @param data 登录数据
   * @returns {Promise<AxiosResponse<ApiResponse<LoginResponse>>>} 登录响应
   */
  login(data: LoginForm): Promise<AxiosResponse<ApiResponse<LoginResponse>>> {
    return adminRequest.post('api/admin/login', data)
  },

  /**
   * 管理员登出
   * @param refreshToken 刷新令牌
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>} 登出响应
   */
  logout(refreshToken?: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.post('api/admin/logout', { refreshToken })
  },

  /**
   * 获取当前登录管理员信息
   * @returns {Promise<AxiosResponse<ApiResponse<AdminUser>>>} 管理员信息
   */
  getProfile(): Promise<AxiosResponse<ApiResponse<AdminUser>>> {
    return adminRequest.get('api/admin/profile')
  },

  /**
   * 修改密码
   * @param data 修改密码数据
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>} 修改结果
   */
  changePassword(data: ChangePasswordForm): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.patch('api/admin/password', data)
  },

  /**
   * 分页查询管理员列表
   * @param query 查询参数
   * @returns {Promise<AxiosResponse<ApiResponse<AdminListResponse>>>} 管理员列表
   */
  getList(query?: AdminQuery): Promise<AxiosResponse<ApiResponse<AdminListResponse>>> {
    return adminRequest.get('api/admin', { params: query })
  },

  /**
   * 创建管理员
   * @param data 管理员数据
   * @returns {Promise<AxiosResponse<ApiResponse<AdminUser>>>} 创建结果
   */
  create(data: CreateAdminForm): Promise<AxiosResponse<ApiResponse<AdminUser>>> {
    return adminRequest.post('api/admin', data)
  },

  /**
   * 更新管理员信息
   * @param id 管理员ID
   * @param data 更新数据
   * @returns {Promise<AxiosResponse<ApiResponse<AdminUser>>>} 更新结果
   */
  update(id: string, data: UpdateAdminForm): Promise<AxiosResponse<ApiResponse<AdminUser>>> {
    return adminRequest.patch(`api/admin/${id}`, data)
  },

  /**
   * 更新管理员状态
   * @param id 管理员ID
   * @param status 状态
   * @returns {Promise<AxiosResponse<ApiResponse<AdminUser>>>} 更新结果
   */
  updateStatus(id: string, status: number): Promise<AxiosResponse<ApiResponse<AdminUser>>> {
    return adminRequest.patch(`api/admin/${id}/status`, { status })
  },

  /**
   * 重置管理员密码
   * @param id 管理员ID
   * @param data 重置密码数据
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>} 重置结果
   */
  resetPassword(id: string, data: ResetPasswordForm): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.post(`api/admin/${id}/reset-password`, data)
  },

  /**
   * 删除管理员
   * @param id 管理员ID
   * @returns {Promise<AxiosResponse<ApiResponse<void>>>} 删除结果
   */
  delete(id: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`api/admin/${id}`)
  },
}

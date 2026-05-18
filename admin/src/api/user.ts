import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

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

export interface ChangePasswordDto {
  oldPassword: string
  newPassword: string
}

export const userApi = {
  /**
   * 获取当前登录用户信息
   * @returns {Promise<AxiosResponse>} 用户信息响应
   */
  getProfile(): Promise<AxiosResponse<{ data: AdminUser }>> {
    return adminRequest.get('api/admin/profile')
  },

  /**
   * 修改密码
   * @param data 修改密码数据
   * @returns {Promise<AxiosResponse>} 修改结果
   */
  changePassword(data: ChangePasswordDto): Promise<AxiosResponse<{ message: string }>> {
    return adminRequest.patch('api/admin/password', data)
  },

  /**
   * 退出登录
   * 清除本地存储的用户信息
   */
  logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    localStorage.removeItem('admin_user')
  }
}

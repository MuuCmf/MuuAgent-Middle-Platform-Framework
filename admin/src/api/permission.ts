import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 权限信息
 */
export interface PermissionInfo {
  id: string
  kbId: string
  uid: string
  role: string
  permissions: string[]
  grantedBy: string
  createdAt: string
}

/**
 * 权限API
 */
export const permissionApi = {
  /**
   * 授予权限
   * @param data 授权参数
   * @returns {Promise<AxiosResponse>} 授权结果
   */
  grant(data: {
    uid: string
    kbId: string
    targetUid: string
    role: string
  }): Promise<AxiosResponse<{ data: PermissionInfo }>> {
    return request.post('/kb/permission/grant', data)
  },

  /**
   * 撤销权限
   * @param data 撤销参数
   * @returns {Promise<AxiosResponse>} 撤销结果
   */
  revoke(data: {
    uid: string
    kbId: string
    targetUid: string
  }): Promise<AxiosResponse<{ data: boolean }>> {
    return request.post('/kb/permission/revoke', data)
  },

  /**
   * 检查权限
   * @param data 检查参数
   * @returns {Promise<AxiosResponse>} 检查结果
   */
  check(data: {
    kbId: string
    uid: string
    permission: string
  }): Promise<AxiosResponse<{ data: { hasPermission: boolean } }>> {
    return request.post('/kb/permission/check', data)
  },

  /**
   * 获取知识库权限列表
   * @param kbId 知识库ID
   * @returns {Promise<AxiosResponse>} 权限列表
   */
  getList(kbId: string): Promise<AxiosResponse<{ data: PermissionInfo[] }>> {
    return request.get(`/kb/permission/list/${kbId}`)
  },

  /**
   * 获取用户权限
   * @param kbId 知识库ID
   * @param uid 用户ID
   * @returns {Promise<AxiosResponse>} 用户权限
   */
  getUserPermission(kbId: string, uid: string): Promise<AxiosResponse<{ data: PermissionInfo | null }>> {
    return request.get('/kb/permission/user', { params: { kbId, uid } })
  }
}

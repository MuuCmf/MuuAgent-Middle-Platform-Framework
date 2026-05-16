import { adminRequest, request } from '@/utils/request'

/**
 * Scope 元数据接口
 */
export interface ScopeMetadata {
  scopes: string[]
  descriptions: Record<string, string>
  hierarchy: Record<string, string[]>
  groups: ScopeGroup[]
}

/**
 * Scope 分组接口
 */
export interface ScopeGroup {
  label: string
  scopes: string[]
}

/**
 * Scope 标签映射接口
 */
export interface ScopeLabels {
  labels: Record<string, string>
}

/**
 * Scope API
 */
export const scopeApi = {
  /**
   * 获取 Scope 元数据（公开接口）
   * @returns {Promise<ScopeMetadata>} Scope 元数据
   */
  async getMetadata(): Promise<ScopeMetadata> {
    const { data } = await request.get<ScopeMetadata>('api/scope/metadata')
    return data.data
  },

  /**
   * 获取 Scope 元数据（需要认证）
   * @returns {Promise<ScopeMetadata>} Scope 元数据
   */
  async getAdminMetadata(): Promise<ScopeMetadata> {
    const { data } = await adminRequest.get<ScopeMetadata>('api/scope/admin/metadata')
    return data.data
  },

  /**
   * 获取 Scope 分组（公开接口）
   * @returns {Promise<ScopeGroup[]>} Scope 分组
   */
  async getGroups(): Promise<ScopeGroup[]> {
    const { data } = await request.get<ScopeGroup[]>('api/scope/groups')
    return data.data
  },

  /**
   * 获取 Scope 分组（需要认证）
   * @returns {Promise<ScopeGroup[]>} Scope 分组
   */
  async getAdminGroups(): Promise<ScopeGroup[]> {
    const { data } = await adminRequest.get<ScopeGroup[]>('api/scope/admin/groups')
    return data.data
  },

  /**
   * 获取 Scope 标签映射（公开接口）
   * @returns {Promise<Record<string, string>>} Scope 标签映射
   */
  async getLabels(): Promise<Record<string, string>> {
    const { data } = await request.get<ScopeLabels>('api/scope/labels')
    return data.data.labels
  },

  /**
   * 获取 Scope 描述映射（公开接口）
   * @returns {Promise<Record<string, string>>} Scope 描述映射
   */
  async getDescriptions(): Promise<Record<string, string>> {
    const { data } = await request.get<Record<string, string>>('api/scope/descriptions')
    return data.data
  }
}

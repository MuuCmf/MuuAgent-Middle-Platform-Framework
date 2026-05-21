import { adminRequest } from '@/utils/request'

/**
 * 内置工具信息
 */
export interface BuiltinTool {
  name: string
  displayName: string
  description: string
  category: string
  sensitive: boolean
  icon?: string
  parameters?: Record<string, any>
  examples?: string[]
  enabled: boolean
}

/**
 * 工具API服务
 */
export const toolApi = {
  /**
   * 获取内置工具列表
   */
  async getBuiltinTools(): Promise<BuiltinTool[]> {
    const response = await adminRequest.get('api/admin/tools/builtin')
    // 处理响应数据格式
    const data = response.data?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  
  /**
   * 获取工具详情
   */
  async getToolDetail(name: string): Promise<BuiltinTool> {
    const response = await adminRequest.get(`api/admin/tools/builtin/${name}`)
    return response.data?.data || response.data
  },
}

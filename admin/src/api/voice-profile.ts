import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

/**
 * 语音配置接口
 */
export interface VoiceProfile {
  id: number
  name: string
  code: string
  voiceId: string
  provider: string
  language: string
  gender?: string
  style?: string
  sampleRate: number
  isDefault: boolean
  status: boolean
  appCode?: string
  createdAt: string
  updatedAt: string
}

/**
 * 语音配置表单接口
 */
export interface VoiceProfileForm {
  name: string
  code: string
  voiceId: string
  provider: string
  language: string
  gender?: string
  style?: string
  sampleRate?: number
  isDefault?: boolean
  status?: boolean
}

/**
 * 语音配置列表响应
 */
export interface VoiceProfileListResponse {
  list: VoiceProfile[]
  total: number
  page: number
  pageSize: number
}

/**
 * 语音配置API
 */
export const voiceProfileApi = {
  /**
   * 分页查询语音配置列表
   * @param params 查询参数
   * @returns {Promise<AxiosResponse>} 分页结果
   */
  getList(params?: {
    page?: number
    pageSize?: number
    provider?: string
    language?: string
    status?: string
    keyword?: string
  }): Promise<AxiosResponse<ApiResponse<VoiceProfileListResponse>>> {
    return adminRequest.get('api/admin/voice-profile', { params })
  },

  /**
   * 获取单个语音配置
   * @param id 语音配置ID
   * @returns {Promise<AxiosResponse>} 语音配置
   */
  getById(id: number): Promise<AxiosResponse<ApiResponse<VoiceProfile>>> {
    return adminRequest.get(`api/admin/voice-profile/${id}`)
  },

  /**
   * 获取默认语音配置
   * @returns {Promise<AxiosResponse>} 默认语音配置
   */
  getDefault(): Promise<AxiosResponse<ApiResponse<VoiceProfile>>> {
    return adminRequest.get('api/admin/voice-profile/default')
  },

  /**
   * 创建语音配置
   * @param data 创建参数
   * @returns {Promise<AxiosResponse>} 创建结果
   */
  create(data: VoiceProfileForm): Promise<AxiosResponse<ApiResponse<VoiceProfile>>> {
    return adminRequest.post('api/admin/voice-profile', data)
  },

  /**
   * 更新语音配置
   * @param id 语音配置ID
   * @param data 更新参数
   * @returns {Promise<AxiosResponse>} 更新结果
   */
  update(id: number, data: Partial<VoiceProfileForm>): Promise<AxiosResponse<ApiResponse<VoiceProfile>>> {
    return adminRequest.put(`api/admin/voice-profile/${id}`, data)
  },

  /**
   * 删除语音配置
   * @param id 语音配置ID
   * @returns {Promise<AxiosResponse>} 删除结果
   */
  delete(id: number): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`api/admin/voice-profile/${id}`)
  },

  /**
   * 设为默认语音配置
   * @param id 语音配置ID
   * @returns {Promise<AxiosResponse>} 更新结果
   */
  setDefault(id: number): Promise<AxiosResponse<ApiResponse<VoiceProfile>>> {
    return adminRequest.patch(`api/admin/voice-profile/${id}/default`)
  },

  /**
   * 测试语音配置
   * @param id 语音配置ID
   * @param text 测试文本
   * @returns {Promise<AxiosResponse>} 测试结果
   */
  testVoice(id: number, text?: string): Promise<AxiosResponse<ApiResponse<any>>> {
    return adminRequest.post(`api/admin/voice-profile/${id}/test`, { text })
  }
}

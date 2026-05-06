import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'
import type { ApiResponse } from '@/utils/request'

export interface ModelTemplate {
  id: string
  name: string
  code: string
  modelType: string
  temperature: number
  topP: number
  contextWindow: number
  maxTokens: number
  sceneTag?: string
  description?: string
  remark?: string
  isDefault: boolean
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface ModelTemplateForm {
  name: string
  code: string
  modelType: string
  temperature: number
  topP: number
  contextWindow: number
  maxTokens: number
  sceneTag?: string
  description?: string
  remark?: string
  isDefault: boolean
  status: boolean
}

export interface ModelTemplateListResponse {
  list: ModelTemplate[]
  total: number
}

export const modelTemplateApi = {
  getList(params?: any): Promise<AxiosResponse<ApiResponse<ModelTemplateListResponse>>> {
    return adminRequest.get('/admin/model-template', { params })
  },
  
  getDetail(id: string): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.get(`/admin/model-template/${id}`)
  },
  
  getByCode(code: string): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.get(`/admin/model-template/code/${code}`)
  },
  
  getDefaultTemplate(modelType: string): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.get(`/admin/model-template/default/${modelType}`)
  },
  
  create(data: ModelTemplateForm): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.post('/admin/model-template', data)
  },
  
  update(id: string, data: Partial<ModelTemplateForm>): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.put(`/admin/model-template/${id}`, data)
  },
  
  delete(id: string): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/model-template/${id}`)
  },
  
  copy(id: string): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.post(`/admin/model-template/copy/${id}`)
  },
  
  setDefault(id: string): Promise<AxiosResponse<ApiResponse<ModelTemplate>>> {
    return adminRequest.put(`/admin/model-template/set-default/${id}`)
  }
}

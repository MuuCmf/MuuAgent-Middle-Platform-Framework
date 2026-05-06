import { adminRequest, type ApiResponse } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface Model {
  id: number
  name: string
  code: string
  type: string
  provider: string
  endpoint?: string
  apiKey?: string
  weight: number
  maxTokens: number
  temperature: number
  status: boolean
  description?: string
  config?: string
  tags?: string
  category?: string
  createdAt: string
  updatedAt: string
  kbUsageCount?: number
}

export interface ModelForm {
  name: string
  code: string
  type: string
  provider: string
  endpoint?: string
  apiKey?: string
  weight: number
  maxTokens: number
  temperature: number
  status: boolean
  description?: string
  config?: string
  tags?: string
  category?: string
}

export interface ModelListResponse {
  list: Model[]
  total: number
}

export const modelApi = {
  getList(): Promise<AxiosResponse<ApiResponse<ModelListResponse>>> {
    return adminRequest.get('/admin/model')
  },
  
  create(data: ModelForm): Promise<AxiosResponse<ApiResponse<Model>>> {
    return adminRequest.post('/admin/model', data)
  },
  
  update(id: number, data: ModelForm): Promise<AxiosResponse<ApiResponse<Model>>> {
    return adminRequest.put(`/admin/model/${id}`, data)
  },
  
  delete(id: number): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/model/${id}`)
  }
}

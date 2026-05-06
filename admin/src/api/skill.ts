import { adminRequest } from '@/utils/request'
import type { AxiosResponse } from 'axios'

export interface Skill {
  id: number
  name: string
  code: string
  type: string
  description: string
  params?: string
  config?: string
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillForm {
  name: string
  code: string
  type: string
  description: string
  params?: string
  config?: string
  status: boolean
}

export interface SkillListResponse {
  list: Skill[]
  total: number
}

export const skillApi = {
  getList(): Promise<AxiosResponse<{ data: SkillListResponse }>> {
    return adminRequest.get('/admin/skill')
  },
  
  create(data: SkillForm): Promise<AxiosResponse> {
    return adminRequest.post('/admin/skill', data)
  },
  
  update(id: number, data: SkillForm): Promise<AxiosResponse> {
    return adminRequest.put(`/admin/skill/${id}`, data)
  },
  
  delete(id: number): Promise<AxiosResponse> {
    return adminRequest.delete(`/admin/skill/${id}`)
  }
}

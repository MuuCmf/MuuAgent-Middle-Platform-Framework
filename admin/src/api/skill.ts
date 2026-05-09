import { adminRequest, type ApiResponse } from '@/utils/request'
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

export interface RenderPromptRequest {
  skillCode: string
  userRequest: string
}

export interface RenderPromptResponse {
  renderedPrompt: string
}

export interface SelectSkillRequest {
  userRequest: string
  availableSkills: string[]
}

export interface SelectSkillResponse {
  skillCode: string
  params: Record<string, unknown>
  prompt?: string
  reason?: string
}

export const skillApi = {
  getList(): Promise<AxiosResponse<ApiResponse<SkillListResponse>>> {
    return adminRequest.get('/admin/skill')
  },
  
  create(data: SkillForm): Promise<AxiosResponse<ApiResponse<Skill>>> {
    return adminRequest.post('/admin/skill', data)
  },
  
  update(id: number, data: SkillForm): Promise<AxiosResponse<ApiResponse<Skill>>> {
    return adminRequest.put(`/admin/skill/${id}`, data)
  },
  
  delete(id: number): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`/admin/skill/${id}`)
  },
  
  /**
   * 执行技能测试
   * @param skillCode 技能标识
   * @param params 执行参数
   */
  execute(skillCode: string, params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse<Record<string, unknown>>>> {
    return adminRequest.post('/admin/skill/execute', { skillCode, params })
  },

  /**
   * 渲染技能调用提示词
   * @param data 渲染参数
   * @returns {Promise<AxiosResponse<ApiResponse<RenderPromptResponse>>>} 渲染结果
   */
  renderPrompt(data: RenderPromptRequest): Promise<AxiosResponse<ApiResponse<RenderPromptResponse>>> {
    return adminRequest.post('/admin/skill/render-prompt', data)
  },

  /**
   * 智能选择技能
   * @param data 选择参数
   * @returns {Promise<AxiosResponse<ApiResponse<SelectSkillResponse>>>} 选择结果
   */
  selectSkill(data: SelectSkillRequest): Promise<AxiosResponse<ApiResponse<SelectSkillResponse>>> {
    return adminRequest.post('/admin/skill/select', data)
  }
}

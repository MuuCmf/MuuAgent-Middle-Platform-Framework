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
  timeout?: number
  codeType?: 'builtin' | 'plugin' | 'sandbox'
  pluginName?: string
  functionName?: string
  codeContent?: string
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
  timeout?: number
  codeType?: 'builtin' | 'plugin' | 'sandbox'
  pluginName?: string
  functionName?: string
  codeContent?: string
}

export interface SkillListResponse {
  list: Skill[]
  total: number
  page: number
  pageSize: number
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

export interface BuiltinFunction {
  name: string
  description: string
  parameters: ParameterDefinition[]
}

export interface ParameterDefinition {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string
  defaultValue?: unknown
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
}

export interface Plugin {
  name: string
  version: string
  description: string
  author?: string
  functions: PluginFunction[]
}

export interface PluginFunction {
  name: string
  description: string
  parameters: ParameterDefinition[]
}

export interface CodeAnalysisResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

export interface TestFunctionParams {
  codeType: 'builtin' | 'plugin' | 'sandbox'
  pluginName?: string
  functionName?: string
  codeContent?: string
  params: Record<string, unknown>
}

export interface FunctionResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  duration?: number
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
  },

  /**
   * 获取内置函数列表
   * @returns {Promise<AxiosResponse<ApiResponse<BuiltinFunction[]>>>} 内置函数列表
   */
  getBuiltinFunctions(): Promise<AxiosResponse<ApiResponse<BuiltinFunction[]>>> {
    return adminRequest.get('/admin/skill/builtin-functions/list')
  },

  /**
   * 获取插件列表
   * @returns {Promise<AxiosResponse<ApiResponse<Plugin[]>>>} 插件列表
   */
  getPlugins(): Promise<AxiosResponse<ApiResponse<Plugin[]>>> {
    return adminRequest.get('/admin/skill/plugins/list')
  },

  /**
   * 分析沙箱代码
   * @param code JavaScript 代码
   * @returns {Promise<AxiosResponse<ApiResponse<CodeAnalysisResult>>>} 分析结果
   */
  analyzeCode(code: string): Promise<AxiosResponse<ApiResponse<CodeAnalysisResult>>> {
    return adminRequest.post('/admin/skill/analyze-code', { code })
  },

  /**
   * 测试函数
   * @param data 测试参数
   * @returns {Promise<AxiosResponse<ApiResponse<FunctionResult>>>} 测试结果
   */
  testFunction(data: TestFunctionParams): Promise<AxiosResponse<ApiResponse<FunctionResult>>> {
    return adminRequest.post('/admin/skill/test-function', data)
  }
}

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
  appCode?: string
  isPublic?: boolean
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
  appCode?: string
  isPublic?: boolean
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

export interface ConnectionTestResult {
  success: boolean
  serverVersion?: string
  latencyMs?: number
  error?: string
}

export interface HttpTestResult {
  status: number
  statusText: string
  headers: Record<string, unknown>
  data: unknown
  costMs: number
}

export const skillApi = {
  getList(): Promise<AxiosResponse<ApiResponse<SkillListResponse>>> {
    return adminRequest.get('api/admin/skill')
  },
  
  create(data: SkillForm): Promise<AxiosResponse<ApiResponse<Skill>>> {
    return adminRequest.post('api/admin/skill', data)
  },
  
  update(id: number, data: SkillForm): Promise<AxiosResponse<ApiResponse<Skill>>> {
    return adminRequest.put(`api/admin/skill/${id}`, data)
  },
  
  delete(id: number): Promise<AxiosResponse<ApiResponse<void>>> {
    return adminRequest.delete(`api/admin/skill/${id}`)
  },
  
  /**
   * 执行技能测试
   * @param skillCode 技能标识
   * @param params 执行参数
   */
  execute(skillCode: string, params: Record<string, unknown> = {}): Promise<AxiosResponse<ApiResponse<Record<string, unknown>>>> {
    return adminRequest.post('api/admin/skill/execute', { skillCode, params })
  },

  /**
   * 渲染技能调用提示词
   * @param data 渲染参数
   * @returns {Promise<AxiosResponse<ApiResponse<RenderPromptResponse>>>} 渲染结果
   */
  renderPrompt(data: RenderPromptRequest): Promise<AxiosResponse<ApiResponse<RenderPromptResponse>>> {
    return adminRequest.post('api/admin/skill/render-prompt', data)
  },

  /**
   * 智能选择技能
   * @param data 选择参数
   * @returns {Promise<AxiosResponse<ApiResponse<SelectSkillResponse>>>} 选择结果
   */
  selectSkill(data: SelectSkillRequest): Promise<AxiosResponse<ApiResponse<SelectSkillResponse>>> {
    return adminRequest.post('api/admin/skill/select', data)
  },

  /**
   * 获取内置函数列表
   * @returns {Promise<AxiosResponse<ApiResponse<BuiltinFunction[]>>>} 内置函数列表
   */
  getBuiltinFunctions(): Promise<AxiosResponse<ApiResponse<BuiltinFunction[]>>> {
    return adminRequest.get('api/admin/skill/builtin-functions/list')
  },

  /**
   * 获取插件列表
   * @returns {Promise<AxiosResponse<ApiResponse<Plugin[]>>>} 插件列表
   */
  getPlugins(): Promise<AxiosResponse<ApiResponse<Plugin[]>>> {
    return adminRequest.get('api/admin/skill/plugins/list')
  },

  /**
   * 分析沙箱代码
   * @param code JavaScript 代码
   * @returns {Promise<AxiosResponse<ApiResponse<CodeAnalysisResult>>>} 分析结果
   */
  analyzeCode(code: string): Promise<AxiosResponse<ApiResponse<CodeAnalysisResult>>> {
    return adminRequest.post('api/admin/skill/analyze-code', { code })
  },

  /**
   * 测试函数
   * @param data 测试参数
   * @returns {Promise<AxiosResponse<ApiResponse<FunctionResult>>>} 测试结果
   */
  testFunction(data: TestFunctionParams): Promise<AxiosResponse<ApiResponse<FunctionResult>>> {
    return adminRequest.post('api/admin/skill/test-function', data)
  },

  /**
   * 测试数据库连接
   * @param config 数据库配置 JSON 字符串
   * @returns 连接测试结果
   */
  testConnection(config: string): Promise<AxiosResponse<ApiResponse<ConnectionTestResult>>> {
    return adminRequest.post('api/admin/skill/test-connection', { config })
  },

  /**
   * 测试 HTTP 请求
   * @param config 技能配置 JSON 字符串
   * @param params 测试参数
   * @returns 测试结果
   */
  testHttpRequest(config: string, params?: Record<string, unknown>): Promise<AxiosResponse<ApiResponse<HttpTestResult>>> {
    return adminRequest.post('api/admin/skill/test-http', { config, params })
  },
}

/**
 * 测试数据库连接（独立导出，供组件直接引用）
 * @param config 数据库配置 JSON 字符串
 * @returns 连接测试结果
 */
export const testDatabaseConnection = (config: string): Promise<ConnectionTestResult> => {
  return skillApi.testConnection(config).then((res) => res.data.data)
}

/**
 * 测试 HTTP 请求（独立导出，供组件直接引用）
 * @param config 技能配置 JSON 字符串
 * @param params 测试参数
 * @returns 测试结果
 */
export const testHttpRequest = (config: string, params?: Record<string, unknown>): Promise<HttpTestResult> => {
  return skillApi.testHttpRequest(config, params).then((res) => res.data.data)
}

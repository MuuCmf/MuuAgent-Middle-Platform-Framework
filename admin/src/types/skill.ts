/**
 * 技能相关类型定义
 */

/**
 * 技能接口
 */
export interface Skill {
  id: string;
  name: string;
  code: string;
  description: string;
  type: 'http' | 'function' | 'database' | 'rpc' | 'mcp';
  params: string;
  config: string;
  status: boolean;
  timeout: number;
  
  codeType?: 'builtin' | 'plugin' | 'sandbox';
  pluginName?: string;
  functionName?: string;
  codeContent?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建技能 DTO
 */
export interface CreateSkillDto {
  name: string;
  code: string;
  description: string;
  type: 'http' | 'function' | 'database' | 'rpc' | 'mcp';
  params: string;
  config: string;
  status?: boolean;
  timeout?: number;
  
  codeType?: 'builtin' | 'plugin' | 'sandbox';
  pluginName?: string;
  functionName?: string;
  codeContent?: string;
}

/**
 * 更新技能 DTO
 */
export interface UpdateSkillDto extends Partial<CreateSkillDto> {}

/**
 * 查询技能 DTO
 */
export interface QuerySkillDto {
  page?: number;
  pageSize?: number;
  name?: string;
  code?: string;
  type?: string;
  status?: boolean;
}

/**
 * 执行技能 DTO
 */
export interface ExecuteSkillDto {
  skillCode: string;
  params: Record<string, unknown>;
}

/**
 * 内置函数信息
 */
export interface BuiltinFunction {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
}

/**
 * 参数定义
 */
export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

/**
 * 插件信息
 */
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  functions: PluginFunction[];
}

/**
 * 插件函数信息
 */
export interface PluginFunction {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
}

/**
 * 代码分析结果
 */
export interface CodeAnalysisResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 测试函数参数
 */
export interface TestFunctionParams {
  codeType: 'builtin' | 'plugin' | 'sandbox';
  pluginName?: string;
  functionName?: string;
  codeContent?: string;
  params: Record<string, unknown>;
}

/**
 * 函数执行结果
 */
export interface FunctionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

/**
 * 技能插件接口
 */
export interface SkillPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  functions: Record<string, SkillFunction>;
}

/**
 * 技能函数接口
 */
export interface SkillFunction {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * 参数定义接口
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
 * 函数执行结果接口
 */
export interface FunctionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

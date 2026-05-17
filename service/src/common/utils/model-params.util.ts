/**
 * 模型参数合并工具
 * 统一处理参数优先级逻辑：调用时传入参数 > 自定义参数 > 场景模板参数 > 系统默认值
 */

/**
 * 模型参数接口
 */
export interface ModelParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextWindow?: number;
}

/**
 * 参数来源接口
 */
export interface ModelParamsSource {
  callParams?: ModelParams | null;
  templateParams?: ModelParams | null;
  customParams?: ModelParams | null;
}

/**
 * 系统默认参数
 */
export const SYSTEM_DEFAULTS: ModelParams = {
  temperature: 0.7,
  topP: 0.7,
  maxTokens: 4096,
  contextWindow: 8192,
};

/**
 * 合并模型参数
 * 优先级：调用参数 > 自定义参数 > 模板参数 > 系统默认值
 * @param sources 参数来源
 * @returns {ModelParams} 合并后的参数
 */
export function mergeModelParams(sources: ModelParamsSource): ModelParams {
  const { callParams, templateParams, customParams } = sources;

  return {
    temperature:
      callParams?.temperature ??
      customParams?.temperature ??
      templateParams?.temperature ??
      SYSTEM_DEFAULTS.temperature,

    topP:
      callParams?.topP ??
      customParams?.topP ??
      templateParams?.topP ??
      SYSTEM_DEFAULTS.topP,

    maxTokens:
      callParams?.maxTokens ??
      customParams?.maxTokens ??
      templateParams?.maxTokens ??
      SYSTEM_DEFAULTS.maxTokens,

    contextWindow:
      callParams?.contextWindow ??
      customParams?.contextWindow ??
      templateParams?.contextWindow ??
      SYSTEM_DEFAULTS.contextWindow,
  };
}

/**
 * 根据场景标签获取推荐的模板类型
 * @param sceneTag 场景标签
 * @returns {string} 推荐的模型类型
 */
export function getRecommendedModelType(sceneTag: string): string {
  const sceneToModelType: Record<string, string> = {
    customer_service: 'llm',
    creative: 'llm',
    code: 'llm',
    vector: 'embedding',
    multimodal: 'multimodal',
  };
  return sceneToModelType[sceneTag] || 'llm';
}

/**
 * 参数值校验
 * @param params 参数对象
 * @returns {ModelParams} 校验后的参数
 */
export function validateModelParams(params: ModelParams): ModelParams {
  const result: ModelParams = {};

  if (params.temperature !== undefined) {
    result.temperature = Math.max(0, Math.min(1, params.temperature));
  }

  if (params.topP !== undefined) {
    result.topP = Math.max(0, Math.min(1, params.topP));
  }

  if (params.maxTokens !== undefined) {
    result.maxTokens = Math.max(1, params.maxTokens);
  }

  if (params.contextWindow !== undefined) {
    result.contextWindow = Math.max(1, params.contextWindow);
  }

  return result;
}

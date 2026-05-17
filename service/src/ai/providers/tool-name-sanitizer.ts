import { jsonSchema, type Tool } from 'ai';

/**
 * 工具名称适配器 — 按 Provider 规则适配工具名
 *
 * 不同模型 API 对 function.name 有不同约束：
 *   OpenAI:    ^[a-zA-Z0-9_-]{1,64}$
 *   DeepSeek:  ^[a-zA-Z0-9_-]+$
 *   Anthropic: ^[a-zA-Z0-9_-]{1,64}$
 *
 * 内部协议名（如 skill__get_weather）对外发送前在此层做合规校验，
 * 同时维护 nameMap 供接收 tool call 时反向映射回内部协议名。
 */

/**
 * Provider 工具名规则
 */
interface ProviderNameRule {
  /** 合法字符正则 */
  validCharPattern: RegExp;
  /** 最大长度（0 = 不限制） */
  maxLength: number;
  /** 非法字符替换为 */
  replacementChar: string;
}

/**
 * 默认规则：OpenAI 兼容（最严格）
 */
const DEFAULT_RULE: ProviderNameRule = {
  validCharPattern: /^[a-zA-Z0-9_-]+$/,
  maxLength: 64,
  replacementChar: '_',
};

/**
 * 各 Provider 专属规则
 */
const PROVIDER_RULES: Record<string, ProviderNameRule> = {
  deepseek: {
    validCharPattern: /^[a-zA-Z0-9_-]+$/,
    maxLength: 0,
    replacementChar: '_',
  },
  openai: DEFAULT_RULE,
  zhipu: DEFAULT_RULE,
  ollama: {
    validCharPattern: /^[a-zA-Z0-9_-]+$/,
    maxLength: 0,
    replacementChar: '_',
  },
};

/**
 * 适配结果
 */
export interface AdaptResult {
  /** 适配后的工具名 → AI SDK Tool */
  tools: Record<string, Tool>;
  /** 适配名 → 原始内部协议名的反向映射 */
  nameMap: Record<string, string>;
}

/**
 * 工具名适配器
 */
export class ToolNameSanitizer {
  /**
   * 将内部工具定义列表适配为 provider 合规的 AI SDK 格式
   * @param toolDefs 内部工具定义（含协议名 name/description/parameters）
   * @param provider Provider 标识（可选，默认 openai 规则）
   * @returns {AdaptResult} 适配结果，含 tools 和 nameMap
   */
  static adapt(
    toolDefs: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>,
    provider?: string,
  ): AdaptResult {
    const rule = PROVIDER_RULES[provider || ''] || DEFAULT_RULE;

    const tools: Record<string, Tool> = {};
    const nameMap: Record<string, string> = {};
    const usedNames = new Set<string>();

    for (const tool of toolDefs) {
      let safeName = this.sanitizeName(tool.name, rule);

      // 去重：如果 sanitize 后的名字已存在，追加序号
      if (usedNames.has(safeName)) {
        let counter = 1;
        while (usedNames.has(`${safeName}_${counter}`)) {
          counter++;
        }
        safeName = `${safeName}_${counter}`;
      }

      usedNames.add(safeName);
      nameMap[safeName] = tool.name;

      tools[safeName] = {
        description: tool.description,
        inputSchema: jsonSchema({
          type: 'object',
          properties: this.convertParameters(tool.parameters),
          required: tool.parameters?.required || [],
        }),
      };
    }

    return { tools, nameMap };
  }

  /**
   * 根据规则清洗工具名
   * @param name 原始名称
   * @param rule Provider 规则
   * @returns {string} 合规名称
   */
  private static sanitizeName(name: string, rule: ProviderNameRule): string {
    // 替换不合法字符
    let safeName = '';
    for (const ch of name) {
      if (rule.validCharPattern.test(ch)) {
        safeName += ch;
      } else {
        safeName += rule.replacementChar;
      }
    }

    // 合并连续下划线
    safeName = safeName.replace(/_+/g, '_');

    // 截断到最大长度（0 = 不限制）
    if (rule.maxLength > 0 && safeName.length > rule.maxLength) {
      safeName = safeName.substring(0, rule.maxLength).replace(/_+$/, '');
    }

    return safeName || 'tool';
  }

  /**
   * 转换参数属性为 AI SDK 格式
   * @param params 参数定义
   * @returns {Record<string, any>} AI SDK 参数格式
   */
  private static convertParameters(params: Record<string, any>): Record<string, any> {
    if (!params || !params.properties) {
      return {};
    }

    const properties: Record<string, any> = {};

    for (const [key, value] of Object.entries(params.properties)) {
      const param = value as any;
      properties[key] = {
        type: param.type || 'string',
        description: param.description || '',
      };

      if (param.enum) {
        properties[key].enum = param.enum;
      }

      if (param.default !== undefined) {
        properties[key].default = param.default;
      }
    }

    return properties;
  }
}
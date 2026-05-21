/**
 * 参数定义接口
 */
interface ParameterDefinition {
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
 * 技能函数接口
 */
interface SkillFunction {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * 技能插件接口
 */
interface SkillPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  functions: Record<string, SkillFunction>;
}

/**
 * 字符串处理插件
 */
export const StringPlugin: SkillPlugin = {
  name: 'string',
  version: '1.0.0',
  description: '字符串处理插件',
  author: 'MuuAgent Team',

  functions: {
    reverse: {
      name: 'reverse',
      description: '字符串反转',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要反转的字符串' },
      ],
      execute: async (params) => {
        const { text } = params;
        return {
          original: text,
          reversed: text.split('').reverse().join(''),
        };
      },
    },

    uppercase: {
      name: 'uppercase',
      description: '转换为大写',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要转换的字符串' },
      ],
      execute: async (params) => {
        const { text } = params;
        return {
          original: text,
          uppercase: text.toUpperCase(),
        };
      },
    },

    lowercase: {
      name: 'lowercase',
      description: '转换为小写',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要转换的字符串' },
      ],
      execute: async (params) => {
        const { text } = params;
        return {
          original: text,
          lowercase: text.toLowerCase(),
        };
      },
    },

    length: {
      name: 'length',
      description: '计算字符串长度',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要计算的字符串' },
      ],
      execute: async (params) => {
        const { text } = params;
        return {
          text,
          length: text.length,
        };
      },
    },

    substring: {
      name: 'substring',
      description: '截取子字符串',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '原字符串' },
        { name: 'start', type: 'number', required: true, description: '起始位置' },
        { name: 'end', type: 'number', required: false, description: '结束位置' },
      ],
      execute: async (params) => {
        const { text, start, end } = params;
        return {
          original: text,
          substring: text.substring(start as number, end as number),
        };
      },
    },
  },
};

export default StringPlugin;

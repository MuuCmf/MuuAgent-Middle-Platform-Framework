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
 * 计算器插件
 */
export const CalculatorPlugin: SkillPlugin = {
  name: 'calculator',
  version: '1.0.0',
  description: '数学计算插件',
  author: 'MuuAI Team',

  functions: {
    add: {
      name: 'add',
      description: '加法运算',
      parameters: [
        { name: 'a', type: 'number', required: true, description: '第一个数' },
        { name: 'b', type: 'number', required: true, description: '第二个数' },
      ],
      execute: async (params) => {
        const { a, b } = params;
        return { result: a + b };
      },
    },

    subtract: {
      name: 'subtract',
      description: '减法运算',
      parameters: [
        { name: 'a', type: 'number', required: true, description: '被减数' },
        { name: 'b', type: 'number', required: true, description: '减数' },
      ],
      execute: async (params) => {
        const { a, b } = params;
        return { result: a - b };
      },
    },

    multiply: {
      name: 'multiply',
      description: '乘法运算',
      parameters: [
        { name: 'a', type: 'number', required: true, description: '第一个数' },
        { name: 'b', type: 'number', required: true, description: '第二个数' },
      ],
      execute: async (params) => {
        const { a, b } = params;
        return { result: a * b };
      },
    },

    divide: {
      name: 'divide',
      description: '除法运算',
      parameters: [
        { name: 'a', type: 'number', required: true, description: '被除数' },
        { name: 'b', type: 'number', required: true, description: '除数' },
      ],
      execute: async (params) => {
        const { a, b } = params;
        if (b === 0) {
          throw new Error('除数不能为 0');
        }
        return { result: a / b };
      },
    },

    power: {
      name: 'power',
      description: '幂运算',
      parameters: [
        { name: 'base', type: 'number', required: true, description: '底数' },
        { name: 'exponent', type: 'number', required: true, description: '指数' },
      ],
      execute: async (params) => {
        const { base, exponent } = params;
        return { result: Math.pow(base, exponent) };
      },
    },
  },
};

export default CalculatorPlugin;

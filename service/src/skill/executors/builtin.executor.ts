import { Injectable, Logger } from '@nestjs/common';
import { FunctionResult } from '../interfaces/plugin.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * 内置函数执行器
 */
@Injectable()
export class BuiltinExecutor {
  private readonly logger = new Logger(BuiltinExecutor.name);

  /**
   * 内置函数映射
   */
  private readonly functions: Record<string, (params: Record<string, unknown>) => Record<string, unknown>> = {
    get_time: () => ({
      time: new Date().toLocaleString('zh-CN'),
      timestamp: Date.now(),
    }),

    get_date: () => ({
      date: new Date().toISOString().split('T')[0],
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
    }),

    echo: (params) => ({
      echo: params,
      timestamp: new Date().toISOString(),
    }),

    random: (params) => {
      const min = (params.min as number) || 0;
      const max = (params.max as number) || 100;
      return {
        random: Math.floor(Math.random() * (max - min + 1)) + min,
        range: { min, max },
      };
    },

    uuid: () => ({
      uuid: uuidv4(),
    }),

    base64_encode: (params) => {
      const text = params.text as string;
      if (!text) throw new Error('text 参数必填');
      return {
        encoded: Buffer.from(text).toString('base64'),
      };
    },

    base64_decode: (params) => {
      const encoded = params.encoded as string;
      if (!encoded) throw new Error('encoded 参数必填');
      return {
        decoded: Buffer.from(encoded, 'base64').toString('utf-8'),
      };
    },

    json_parse: (params) => {
      const text = params.text as string;
      if (!text) throw new Error('text 参数必填');
      return {
        parsed: JSON.parse(text),
      };
    },

    json_stringify: (params) => {
      const obj = params.object;
      if (obj === undefined) throw new Error('object 参数必填');
      return {
        stringified: JSON.stringify(obj, null, 2),
      };
    },
  };

  /**
   * 执行内置函数
   * @param functionName 函数名称
   * @param params 参数
   * @returns 执行结果
   */
  async execute(
    functionName: string,
    params: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const startTime = Date.now();

    try {
      const func = this.functions[functionName];
      if (!func) {
        return {
          success: false,
          error: `未知的内置函数: ${functionName}`,
        };
      }

      const data = func(params);
      const duration = Date.now() - startTime;

      this.logger.log(`内置函数 ${functionName} 执行成功，耗时 ${duration}ms`);

      return {
        success: true,
        data,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`内置函数 ${functionName} 执行失败`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        duration,
      };
    }
  }

  /**
   * 检查函数是否存在
   * @param functionName 函数名称
   * @returns 是否存在
   */
  hasFunction(functionName: string): boolean {
    return functionName in this.functions;
  }

  /**
   * 获取所有内置函数列表
   */
  getFunctionList(): Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      required: boolean;
      description?: string;
    }>;
  }> {
    return [
      {
        name: 'get_time',
        description: '获取当前时间',
        parameters: [],
      },
      {
        name: 'get_date',
        description: '获取当前日期',
        parameters: [],
      },
      {
        name: 'echo',
        description: '回显输入参数',
        parameters: [
          { name: 'value', type: 'string', required: true, description: '要回显的值' },
        ],
      },
      {
        name: 'random',
        description: '生成随机数',
        parameters: [
          { name: 'min', type: 'number', required: false, description: '最小值，默认 0' },
          { name: 'max', type: 'number', required: false, description: '最大值，默认 100' },
        ],
      },
      {
        name: 'uuid',
        description: '生成 UUID',
        parameters: [],
      },
      {
        name: 'base64_encode',
        description: 'Base64 编码',
        parameters: [
          { name: 'text', type: 'string', required: true, description: '要编码的文本' },
        ],
      },
      {
        name: 'base64_decode',
        description: 'Base64 解码',
        parameters: [
          { name: 'encoded', type: 'string', required: true, description: '要解码的 Base64 字符串' },
        ],
      },
      {
        name: 'json_parse',
        description: 'JSON 解析',
        parameters: [
          { name: 'text', type: 'string', required: true, description: '要解析的 JSON 字符串' },
        ],
      },
      {
        name: 'json_stringify',
        description: 'JSON 序列化',
        parameters: [
          { name: 'object', type: 'object', required: true, description: '要序列化的对象' },
        ],
      },
    ];
  }
}

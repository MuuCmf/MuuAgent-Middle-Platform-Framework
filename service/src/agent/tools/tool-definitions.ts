import { ToolDefinition } from '../react/react.types';

/**
 * Function Calling 工具定义
 * 遵循 OpenAI Function Calling 标准格式
 */

/**
 * 工具定义接口（Function Calling 格式）
 */
export interface FunctionToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * 工具定义构建器
 * 将内部 ToolDefinition 转换为 Function Calling 格式
 */
export class ToolDefinitionBuilder {
  /**
   * 构建知识库检索工具定义
   * @param kbCodes 知识库代码列表
   * @param kbNames 知识库名称列表
   * @returns Function Calling 工具定义
   */
  static buildKbSearchTool(kbCodes: string[], kbNames: string[]): FunctionToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'kb_search',
        description: `从知识库中检索相关信息。绑定的知识库: ${kbNames.join(', ')}。当需要查询产品信息、文档内容、FAQ等知识库内容时使用此工具。`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '检索查询语句，应该是一个清晰的问题或关键词',
            },
            kb_codes: {
              type: 'array',
              items: { type: 'string' },
              description: `可选，指定要检索的知识库代码列表。可用知识库: ${kbCodes.join(', ')}。不指定则检索所有绑定的知识库`,
            },
            top_k: {
              type: 'number',
              description: '可选，返回的结果数量，默认5',
            },
            similarity_threshold: {
              type: 'number',
              description: '可选，相似度阈值(0-1)，默认0.7',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  /**
   * 构建技能工具定义
   * @param skillCode 技能代码
   * @param skillName 技能名称
   * @param description 技能描述
   * @param parameters 技能参数
   * @returns Function Calling 工具定义
   */
  static buildSkillTool(
    skillCode: string,
    skillName: string,
    description: string,
    parameters: Record<string, any>,
  ): FunctionToolDefinition {
    return {
      type: 'function',
      function: {
        name: skillCode,
        description: description || `执行${skillName}技能`,
        parameters: {
          type: 'object',
          properties: parameters?.properties || {},
          required: parameters?.required || [],
        },
      },
    };
  }

  /**
   * 构建 MCP 工具定义
   * @param serverName MCP 服务器名称
   * @param toolName 工具名称
   * @param description 工具描述
   * @param inputSchema 输入参数 Schema
   * @returns Function Calling 工具定义
   */
  static buildMcpTool(
    serverName: string,
    toolName: string,
    description: string,
    inputSchema: Record<string, any>,
  ): FunctionToolDefinition {
    return {
      type: 'function',
      function: {
        name: `mcp:${serverName}:${toolName}`,
        description: description || `MCP工具: ${toolName}`,
        parameters: {
          type: 'object',
          properties: inputSchema?.properties || {},
          required: inputSchema?.required || [],
        },
      },
    };
  }

  /**
   * 批量转换工具定义
   * @param tools 内部工具定义列表
   * @returns Function Calling 工具定义列表
   */
  static convertToFunctionCallingFormat(tools: ToolDefinition[]): FunctionToolDefinition[] {
    const validTypes = ['kb', 'skill', 'mcp', 'builtin'];
    return tools.map(tool => {
      if (!validTypes.includes(tool.type)) {
        throw new Error(`Unknown tool type: ${tool.type}`);
      }
      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object' as const,
            properties: tool.parameters?.properties || {},
            required: tool.parameters?.required || [],
          },
        },
      };
    });
  }
}

/**
 * 内置工具定义
 * 提供常用的内置工具定义
 */
export const BUILTIN_TOOL_DEFINITIONS: Record<string, FunctionToolDefinition> = {
  /**
   * 获取当前时间
   */
  get_time: {
    type: 'function',
    function: {
      name: 'get_time',
      description: '获取当前时间',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  /**
   * 获取天气信息
   */
  get_weather: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称，例如：北京、上海',
          },
        },
        required: ['city'],
      },
    },
  },

  /**
   * 发送邮件
   */
  send_email: {
    type: 'function',
    function: {
      name: 'send_email',
      description: '发送邮件',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: '收件人邮箱地址',
          },
          subject: {
            type: 'string',
            description: '邮件主题',
          },
          body: {
            type: 'string',
            description: '邮件内容',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
};

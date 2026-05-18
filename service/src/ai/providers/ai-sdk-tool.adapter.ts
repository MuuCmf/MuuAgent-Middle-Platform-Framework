import { ToolDefinition } from '../../agent/tools/abstract/tool.interface';
import { jsonSchema, type Tool } from 'ai';

/**
 * AI SDK 工具适配器
 * 将现有 ToolDefinition 转换为 AI SDK v3 的 tool 格式
 */
export class AiSdkToolAdapter {
  /**
   * 转换工具定义列表为 AI SDK v3 格式
   */
  static toAisSdkTools(tools: ToolDefinition[]): Record<string, Tool> {
    if (!tools || tools.length === 0) {
      return {};
    }

    const result: Record<string, Tool> = {};
    
    for (const tool of tools) {
      result[tool.name] = {
        description: tool.description,
        inputSchema: jsonSchema({
          type: 'object',
          properties: this.convertParameters(tool.parameters),
          required: tool.parameters?.required || [],
        }),
      };
    }
    
    return result;
  }

  /**
   * 转换参数定义
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

  /**
   * 创建工具执行回调
   */
  static createToolExecutor(
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ): (toolCall: { name: string; args: Record<string, unknown> }) => Promise<unknown> {
    return async ({ name, args }) => {
      try {
        const result = await executeTool(name, args);
        return typeof result === 'object' ? result : { result };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Tool execution failed' };
      }
    };
  }
}

/**
 * 扩展推理步骤，包含 AI SDK 的 toolCall 信息
 */
export interface ExtendedReasoningStep {
  stepNumber: number;
  stepType: string;
  content?: string;
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: string;
  toolOutput?: unknown;
  toolCallId?: string;
  toolCallName?: string;
  costMs?: number;
}
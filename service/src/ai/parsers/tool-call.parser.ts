import { Injectable, Logger } from '@nestjs/common';
import { ToolCall } from '../interfaces/executor.interface';

/**
 * 工具调用解析器
 * 解析不同格式的工具调用
 */
@Injectable()
export class ToolCallParser {
  private readonly logger = new Logger(ToolCallParser.name);

  /**
   * 函数调用标记
   */
  private readonly FUNCTION_CALL_BEGIN = '<|FunctionCallBegin|>';
  private readonly FUNCTION_CALL_END = '<|FunctionCallEnd|>';

  /**
   * 解析文本格式的工具调用
   * 支持三种格式：
   * 1. ReAct 格式：Action: xxx / Action Input: xxx
   * 2. 函数式 格式：<|FunctionCallBegin|>[{"name":"xxx","parameters":{}}]<|FunctionCallEnd|>
   * 3. 通用 JSON 格式：[{"name":"xxx","arguments":{}}]
   * @param text 模型输出的文本
   * @returns 工具调用信息或 null
   */
  parseFromText(text: string): ToolCall | null {
    const functionCall = this.parseFunctionCallFormat(text);
    if (functionCall) return functionCall;

    const reactCall = this.parseReActFormat(text);
    if (reactCall) return reactCall;

    return null;
  }

  /**
   * 解析函数式格式
   * @param text 文本
   * @returns 工具调用或 null
   */
  private parseFunctionCallFormat(text: string): ToolCall | null {
    const match = text.match(/<\|FunctionCallBegin\|>([\s\S]*?)<\|FunctionCallEnd\|>/);
    if (!match) return null;

    try {
      const calls = JSON.parse(match[1].trim());
      if (Array.isArray(calls) && calls.length > 0) {
        const call = calls[0];
        return {
          toolCallId: `text-${Date.now()}`,
          toolName: call.name,
          args: call.parameters || call.arguments || call.args || {},
        };
      }
    } catch (e) {
      this.logger.debug(`解析 FunctionCallBegin 格式失败: ${match[1]}`);
    }

    return null;
  }

  /**
   * 解析 ReAct 格式
   * @param text 文本
   * @returns 工具调用或 null
   */
  private parseReActFormat(text: string): ToolCall | null {
    const actionMatch = text.match(/Action:\s*([^\n]+)/i);
    if (!actionMatch) return null;

    const name = actionMatch[1].trim();
    let args = {};

    const actionInputMatch = text.match(
      /Action\s*Input:\s*(\{[\s\S]*?\}|\[.*?\]|"[^"]*"|[^,\n]+)/i
    );

    if (actionInputMatch) {
      const argsStr = actionInputMatch[1].trim();
      args = this.parseActionInput(argsStr);
    }

    return {
      toolCallId: `react-${Date.now()}`,
      toolName: name,
      args,
    };
  }

  /**
   * 解析 Action Input
   * @param argsStr 参数字符串
   * @returns 参数对象
   */
  private parseActionInput(argsStr: string): Record<string, unknown> {
    try {
      if (argsStr.startsWith('{') || argsStr.startsWith('[')) {
        return JSON.parse(argsStr);
      }
      if (argsStr.startsWith('"') && argsStr.endsWith('"')) {
        return { input: argsStr.slice(1, -1) };
      }
      return { input: argsStr };
    } catch (e) {
      this.logger.debug(`解析 Action Input 失败: ${argsStr}`);
      return { raw: argsStr };
    }
  }

  /**
   * 检测文本中是否包含函数调用标记
   * @param text 文本
   * @returns 是否包含标记
   */
  containsFunctionCallMarkers(text: string): boolean {
    return text.includes(this.FUNCTION_CALL_BEGIN);
  }

  /**
   * 清除文本中的函数调用标记
   * @param text 文本
   * @returns 清除标记后的文本
   */
  stripFunctionCallMarkers(text: string): string {
    const pattern = new RegExp(
      `${this.escapeRegex(this.FUNCTION_CALL_BEGIN)}[\\s\\S]*?${this.escapeRegex(this.FUNCTION_CALL_END)}`,
      'g'
    );
    return text.replace(pattern, '').trim();
  }

  /**
   * 转义正则特殊字符
   * @param str 字符串
   * @returns 转义后的字符串
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 尝试解析 JSON 格式的工具调用
   * @param text 文本
   * @returns 工具调用数组或 null
   */
  parseJsonToolCalls(text: string): ToolCall[] | null {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return data.map((item, index) => ({
          toolCallId: item.id || `json-${Date.now()}-${index}`,
          toolName: item.name || item.function?.name || '',
          args: item.arguments || item.parameters || item.function?.arguments || {},
        }));
      }
    } catch (e) {
      // 不是 JSON 格式
    }
    return null;
  }
}

import { ReActParseResult, StepType } from './react.types';

/**
 * ReAct 响应解析器
 */
export class ReActParser {
  /**
   * 解析 LLM 响应，提取 ReAct 步骤
   */
  static parse(response: string): ReActParseResult {
    const trimmedResponse = response.trim();

    // 优先检查 Action（确保工具被执行，而不是跳过到 Final Answer）
    const actionMatch = this.extractAction(trimmedResponse);
    if (actionMatch) {
      return {
        type: StepType.ACTION,
        thought: this.extractThought(trimmedResponse),
        action: actionMatch.action,
        actionInput: actionMatch.actionInput,
        rawContent: trimmedResponse,
      };
    }

    // 检查是否包含 Final Answer
    const finalAnswerMatch = this.extractFinalAnswer(trimmedResponse);
    if (finalAnswerMatch) {
      return {
        type: StepType.FINAL_ANSWER,
        thought: this.extractThought(trimmedResponse),
        finalAnswer: finalAnswerMatch,
        rawContent: trimmedResponse,
      };
    }

    // 检查是否只有 Thought
    const thought = this.extractThought(trimmedResponse);
    if (thought) {
      return {
        type: StepType.THOUGHT,
        thought,
        rawContent: trimmedResponse,
      };
    }

    // 无法解析，可能是自由文本回答
    return {
      type: StepType.FINAL_ANSWER,
      finalAnswer: trimmedResponse,
      rawContent: trimmedResponse,
    };
  }

  /**
   * 提取 Thought 内容
   */
  private static extractThought(text: string): string | undefined {
    const patterns = [
      /Thought:\s*([^\n]+)/i,
      /思考:\s*([^\n]+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 提取 Action 和 Action Input
   */
  private static extractAction(text: string): { action: string; actionInput: Record<string, unknown> } | null {
    // 匹配 Action
    const actionPatterns = [
      /Action:\s*([^\n]+)/i,
      /行动:\s*([^\n]+)/,
    ];

    let action: string | undefined;
    for (const pattern of actionPatterns) {
      const match = text.match(pattern);
      if (match) {
        action = match[1].trim();
        break;
      }
    }

    let actionInput: Record<string, unknown> = {};

    // 如果没有找到标准格式的 Action，尝试解析简化格式
    if (!action) {
      const simplifiedMatch = this.extractSimplifiedAction(text);
      if (simplifiedMatch) {
        action = simplifiedMatch.action;
        actionInput = simplifiedMatch.actionInput;
      } else {
        return null;
      }
    } else {
      // 匹配 Action Input
      const inputPatterns = [
        /Action Input:\s*(\{[\s\S]*?\})/i,
        /行动输入:\s*(\{[\s\S]*?\})/,
      ];

      for (const pattern of inputPatterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            actionInput = JSON.parse(match[1].trim());
          } catch {
            actionInput = { raw: match[1].trim() };
          }
          break;
        }
      }
    }

    return { action, actionInput };
  }

  /**
   * 提取简化格式的工具调用（如：get_time \n {}）
   */
  private static extractSimplifiedAction(text: string): { action: string; actionInput: Record<string, unknown> } | null {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length >= 2) {
      // 第一行可能是工具名称
      const potentialAction = lines[0].trim();
      // 第二行可能是 JSON 参数
      const potentialInput = lines[1].trim();
      
      if (potentialInput.startsWith('{') && potentialInput.endsWith('}')) {
        try {
          const parsedInput = JSON.parse(potentialInput);
          if (typeof parsedInput === 'object') {
            return { action: potentialAction, actionInput: parsedInput };
          }
        } catch {
          // 不是有效的 JSON，继续尝试其他格式
        }
      }
    }
    
    return null;
  }

  /**
   * 提取 Final Answer
   */
  private static extractFinalAnswer(text: string): string | undefined {
    const patterns = [
      /Final Answer:\s*([\s\S]*?)(?=Thought:|Action:|Action Input:|$)/i,
      /最终答案:\s*([\s\S]*?)(?=思考:|行动:|行动输入:|$)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 验证解析结果是否有效
   */
  static isValid(result: ReActParseResult): boolean {
    if (result.type === StepType.ACTION) {
      return !!result.action;
    }
    if (result.type === StepType.FINAL_ANSWER) {
      return !!result.finalAnswer;
    }
    return true;
  }
}

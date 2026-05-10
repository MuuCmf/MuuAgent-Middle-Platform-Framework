import { ToolDefinition, ReasoningStep } from './react.types';

/**
 * ReAct 提示词构建器
 */
export class ReActPromptBuilder {
  /**
   * 构建完整的 ReAct 系统提示词
   */
  static buildSystemPrompt(
    basePrompt: string,
    tools: ToolDefinition[],
    customPrompt?: string,
  ): string {
    const toolDescriptions = this.buildToolDescriptions(tools);

    if (customPrompt) {
      return customPrompt
        .replace('{BASE_PROMPT}', basePrompt)
        .replace('{TOOLS}', toolDescriptions);
    }

    return `${basePrompt}

## 可用工具

${toolDescriptions}

## 工具使用说明

当用户的问题需要使用工具来获取信息时，请调用相应的工具。系统会自动处理工具调用的格式和执行。

## 推理流程

1. **分析问题**：理解用户的问题和需求
2. **选择工具**：根据问题选择合适的工具
3. **执行工具**：系统会自动执行工具并返回结果
4. **整合信息**：基于工具返回的结果进行推理
5. **生成答案**：用自然语言回答用户问题

## 重要提示

- 当用户询问时间、日期等实时信息时，请调用 get_time 工具
- 当需要查询知识库时，请调用 kb_search 工具
- 当需要执行特定技能时，请调用相应的技能工具
- 如果不需要工具就能回答问题，直接回答即可
- 工具调用会自动处理，你只需要专注于推理和回答
- 最终答案要用自然语言表达，不要提及工具调用细节

现在请开始回答用户的问题！`;
  }

  /**
   * 构建工具描述
   */
  private static buildToolDescriptions(tools: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return '当前没有可用工具。';
    }

    // 分类工具
    const kbTools = tools.filter(t => t.type === 'kb');
    const skillTools = tools.filter(t => t.type === 'skill');
    const mcpTools = tools.filter(t => t.type === 'mcp');

    let description = '';

    // 知识库工具
    if (kbTools.length > 0) {
      description += `## 知识库检索工具\n\n使用这些工具从知识库中检索相关信息。\n\n`;
      for (const tool of kbTools) {
        description += this.formatToolDescription(tool);
      }
    }

    // 技能工具
    if (skillTools.length > 0) {
      description += `\n## 技能工具\n\n`;
      for (const tool of skillTools) {
        description += this.formatToolDescription(tool);
      }
    }

    // MCP 工具
    if (mcpTools.length > 0) {
      description += `\n## MCP 工具\n\n`;
      for (const tool of mcpTools) {
        description += this.formatToolDescription(tool);
      }
    }

    return description;
  }

  /**
   * 格式化单个工具描述
   */
  private static formatToolDescription(tool: ToolDefinition): string {
    const params = Object.entries(tool.parameters?.properties || {})
      .map(([key, value]) => {
        const v = value as any;
        const required = tool.parameters?.required?.includes(key);
        return `  - ${key}${required ? '(必填)' : '(可选)'}: ${v.description || v.type}`;
      })
      .join('\n');

    return `### ${tool.name}
${tool.description}
参数:
${params || '  无参数'}

`;
  }

  /**
   * 构建下一步提示（包含系统上下文）
   */
  static buildNextPrompt(
    systemPrompt: string,
    userMessage: string,
    steps: ReasoningStep[],
    observation?: string,
  ): string {
    let prompt = `${systemPrompt}\n\n用户问题: ${userMessage}\n`;

    for (const step of steps) {
      if (step.thought) {
        prompt += `Thought: ${step.thought}\n`;
      }
      if (step.action) {
        prompt += `Action: ${step.action}\n`;
        prompt += `Action Input: ${JSON.stringify(step.actionInput || {})}\n`;
      }
      if (step.observation) {
        prompt += `Observation: ${step.observation}\n`;
      }
    }

    if (observation) {
      prompt += `Observation: ${observation}\n`;
    }

    return prompt;
  }
}

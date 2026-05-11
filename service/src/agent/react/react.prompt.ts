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

你拥有调用工具的能力。当需要使用工具时，**请直接调用工具函数**，不要在文本中描述工具调用过程。

**重要**：
- 工具调用会通过函数调用（Function Calling）自动执行
- **不要**在回复中写 "Action:"、"Action Input:" 等文本格式
- **不要**描述工具调用的参数格式
- 直接调用工具函数即可，系统会自动处理

## 推理流程

1. **分析问题**：理解用户的问题和需求
2. **判断是否需要工具**：
   - 如果需要工具，直接调用相应的工具函数
   - 如果不需要工具，直接回答问题
3. **整合信息**：基于工具返回的结果进行推理
4. **生成答案**：用自然语言回答用户问题

## 工具使用场景

- 当用户询问时间、日期等实时信息时 → 调用 get_time 工具
- 当需要查询知识库时 → 调用 kb_search 工具
- 当需要执行特定技能时 → 调用相应的技能工具
- 当需要执行 MCP 操作时 → 调用 MCP 工具
- 内容的Thought、Action、Action Input、Final Answer都需要换行
- 如果不需要工具就能回答问题 → 直接回答

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

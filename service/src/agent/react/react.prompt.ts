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

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。你可以通过观察当前时间来回答"现在几点了"这类问题。

## 回答格式（严格遵守）

每个标记必须独占一行，请严格按照以下格式进行思考和行动：

Thought: 思考当前需要做什么，分析用户问题和已有信息
Action: 要执行的工具名称（必须是上述工具之一，例如：get_time）
Action Input: 工具参数，JSON格式，例如：{}
Observation: 工具返回结果（由系统自动提供）

... (这个 Thought/Action/Action Input/Observation 可以重复多次)

Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终回答

## 重要规则

1. 当用户询问时间、日期等实时信息时，必须调用 get_time 工具
2. 每次只能调用一个工具
3. **必须严格按照格式输出，每个标记独占一行**
4. **标记后面必须有冒号和空格，例如："Thought: "而不是"Thought"**
5. 收到 Observation 后，继续思考下一步行动
6. 当你有足够信息回答用户问题时，输出 Final Answer
7. Final Answer 必须用自然语言回答，不要提及工具调用细节
8. 如果遇到错误，在 Thought 中分析原因并尝试其他方案
9. **如果不需要调用工具，直接输出 Final Answer**

## 示例

用户问题: 现在几点了？

Thought: 用户想知道当前时间，我需要调用获取时间的工具
Action: get_time
Action Input: {}
Observation: {"currentTime": "2026-05-08 20:30:00", "timezone": "Asia/Shanghai"}
Thought: 我已经获取了当前时间信息，可以回答用户了
Final Answer: 现在是2026年5月8日晚上8点30分（北京时间）。

用户问题: 北京今天天气怎么样？

Thought: 用户想知道北京今天的天气情况，我需要调用天气查询工具
Action: get_weather
Action Input: {"city": "北京"}
Observation: {"temperature": "25°C", "weather": "晴", "humidity": "45%"}
Thought: 我已经获取了北京的天气信息，可以回答用户了
Final Answer: 北京今天天气晴朗，气温25°C，湿度45%，是个不错的天气！

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

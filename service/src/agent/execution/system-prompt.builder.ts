import { Injectable, Logger } from '@nestjs/common';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { ReasoningMode } from '../../reasoning/types';

@Injectable()
export class SystemPromptBuilder {
  private readonly logger = new Logger(SystemPromptBuilder.name);

  /** 工具数量阈值，超过此值启用精简模式 */
  private readonly TOOL_COUNT_THRESHOLD = 15;

  /** 单个工具描述最大长度（字符） */
  private readonly MAX_TOOL_DESC_LENGTH = 200;

  /**
   * 构建系统提示词
   * @param agent Agent配置
   * @param tools 工具定义列表
   * @returns 完整的系统提示词
   */
  build(agent: { systemPrompt?: string; reasoningMode?: string; reasoningPrompt?: string }, tools: ToolDefinition[]): string {
    let systemPrompt = agent.systemPrompt || '';

    if (agent.reasoningMode && agent.reasoningMode !== 'NONE') {
      const reasoningPrompt = agent.reasoningPrompt || this.getDefaultReasoningPrompt(agent.reasoningMode);
      systemPrompt = reasoningPrompt + '\n\n' + systemPrompt;
    }

    if (agent.reasoningMode && agent.reasoningMode !== 'NONE') {
      systemPrompt += '\n\n' + this.getThinkingTagInstruction();
    }

    if (tools.length === 0) {
      return systemPrompt;
    }

    const useCompactMode = tools.length > this.TOOL_COUNT_THRESHOLD;
    this.logger.debug(`构建工具描述: ${tools.length} 个工具, ${useCompactMode ? '使用精简模式' : '使用详细模式'}`);

    const toolDescriptions = useCompactMode
      ? this.buildCompactToolDescriptions(tools)
      : this.buildDetailedToolDescriptions(tools);

    const toolSectionHeader = useCompactMode
      ? `## 可用工具 (共${tools.length}个，输入工具名称获取详细帮助)`
      : '## 可用工具';

    systemPrompt = `${systemPrompt}\n\n${toolSectionHeader}\n\n${toolDescriptions}`;

    return systemPrompt;
  }

  /**
   * 构建详细的工具描述（默认模式）
   * @param tools 工具列表
   * @returns 详细工具描述文本
   */
  private buildDetailedToolDescriptions(tools: ToolDefinition[]): string {
    return tools.map(t => {
      const simplifiedParams = this.simplifyParameters(t.parameters);
      let description = t.description || '';

      if (description.length > this.MAX_TOOL_DESC_LENGTH) {
        description = description.substring(0, this.MAX_TOOL_DESC_LENGTH - 3) + '...';
      }

      return `- ${t.name}: ${description}\n参数: ${simplifiedParams}`;
    }).join('\n');
  }

  /**
   * 构建精简的工具描述（工具过多时使用）
   * @param tools 工具列表
   * @returns 精简工具描述文本
   */
  private buildCompactToolDescriptions(tools: ToolDefinition[]): string {
    const toolGroups = this.groupToolsByCategory(tools);
    const groupDescriptions: string[] = [];

    for (const [category, categoryTools] of Object.entries(toolGroups)) {
      const toolList = categoryTools.map(t => {
        const shortDesc = (t.description || '').split('。')[0];
        return `  - **${t.name}**: ${shortDesc}`;
      }).join('\n');

      groupDescriptions.push(`### ${category}\n${toolList}`);
    }

    const compactOutput = [
      ...groupDescriptions,
      '\n> 💡 提示：如需了解某个工具的详细参数，请在回复中提及该工具名称',
    ].join('\n\n');

    return compactOutput;
  }

  /**
   * 按前缀分组工具
   * @param tools 工具列表
   * @returns 分组后的工具映射
   */
  private groupToolsByCategory(tools: ToolDefinition[]): Record<string, ToolDefinition[]> {
    const groups: Record<string, ToolDefinition[]> = {};

    for (const tool of tools) {
      const parts = tool.name.split('__');
      let prefix: string;

      if (parts.length >= 3) {
        prefix = `${parts[0]}__${parts[1]}`;
      } else if (parts.length === 2) {
        prefix = parts[0];
      } else {
        prefix = tool.name; // 对于没有 __ 的工具名，使用完整名称
      }

      const categoryName = this.getCategoryName(prefix);

      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(tool);
    }

    return groups;
  }

  /**
   * 获取分类显示名称
   * @param prefix 工具名前缀
   * @returns 分类名称
   */
  private getCategoryName(prefix: string): string {
    const categoryMap: Record<string, string> = {
      'mcp__filesystem': '📁 文件系统操作',
      'mcp__http': '🌐 网络请求',
      'mcp__database': '🗄️ 数据库操作',
      'http_request': '🌐 网络请求',
      'kb_search': '📚 知识库检索',
      'run_code': '💻 代码执行',
      'db_query': '🗄️ 数据库查询',
      'other': '🔧 其他工具',
    };

    return categoryMap[prefix] || `🔧 ${prefix}`;
  }

  /**
   * 简化参数描述
   * @param parameters 参数定义
   * @returns 简化后的参数字符串
   */
  private simplifyParameters(parameters: any): string {
    if (!parameters || !parameters.properties) {
      return '{}';
    }

    const required = parameters.required || [];
    const props = parameters.properties;
    const simplified: Record<string, string> = {};

    for (const [key, value] of Object.entries(props)) {
      const prop = value as any;
      const isRequired = required.includes(key);
      const typeDesc = prop.type || 'any';
      const enumDesc = prop.enum ? ` (${prop.enum.join('|')})` : '';
      const desc = prop.description ? ` - ${prop.description}` : '';
      const reqMark = isRequired ? '*' : '';

      simplified[key] = `${typeDesc}${enumDesc}${reqMark}${desc}`;
    }

    return JSON.stringify(simplified, null, 0);
  }

  /**
   * 获取 thinking 标签输出格式指令
   * 无论使用默认还是自定义推理提示词，此指令都会被强制注入，
   * 确保模型输出符合后端 ThinkingTagParser 的解析契约。
   * @returns thinking 标签格式指令
   */
  private getThinkingTagInstruction(): string {
    return `## 输出格式要求（必须遵守）

每次响应必须使用 <thinking> 标签包裹你的内部推理过程，格式如下：

<thinking>
你的推理、分析、规划过程
</thinking>
然后调用工具或给出最终回答。

**严格要求：**
- 每次响应必须以 <thinking> 开头，以 </thinking> 结束
- <thinking> 标签内是内部推理，标签外是对用户的回答
- 如果需要调用工具，请在 </thinking> 后直接调用
- 如果不需要调用工具，请在 </thinking> 后直接给出最终回答
- 绝对不能省略 <thinking> 标签`;
  }

  /**
   * 获取默认推理提示词
   * 注意：thinking 标签格式指令由 getThinkingTagInstruction() 统一注入，此处只定义推理逻辑
   * @param mode 推理模式
   * @returns 推理提示词
   */
  private getDefaultReasoningPrompt(mode: string): string {
    switch (mode) {
      case ReasoningMode.REACT:
        return `## 推理规则
你是一个能够使用工具的智能助手。

推理步骤：
1. 分析用户问题和现有信息
2. 判断是否需要调用工具
3. 如果需要，说明调用哪个工具以及原因`;
      case ReasoningMode.PLAN:
        return `## 推理规则
你是一个能够进行规划的智能助手。

推理步骤：
1. 分析问题，明确目标
2. 制定详细的执行计划
3. 列出需要调用的工具和顺序`;
      case ReasoningMode.REFLECT:
        return `## 推理规则
你是一个具有反思能力的智能助手。

推理步骤：
1. 分析当前情况和已有信息
2. 反思之前的操作是否正确
3. 检查是否有遗漏或更好的方法
4. 决定下一步行动`;
      default:
        return '';
    }
  }
}

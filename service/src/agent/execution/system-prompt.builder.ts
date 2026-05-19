import { Injectable } from '@nestjs/common';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { ReasoningMode } from '../../reasoning/types';

@Injectable()
export class SystemPromptBuilder {
  build(agent: { systemPrompt?: string; reasoningMode?: string; reasoningPrompt?: string }, tools: ToolDefinition[]): string {
    let systemPrompt = agent.systemPrompt || '';

    if (agent.reasoningMode && agent.reasoningMode !== 'NONE') {
      const reasoningPrompt = agent.reasoningPrompt || this.getDefaultReasoningPrompt(agent.reasoningMode);
      systemPrompt = reasoningPrompt + '\n\n' + systemPrompt;
    }

    const toolDescriptions = tools.map(t => {
      const simplifiedParams = this.simplifyParameters(t.parameters);
      return `- ${t.name}: ${t.description}\n参数: ${simplifiedParams}`;
    }).join('\n');

    if (toolDescriptions) {
      systemPrompt = `${systemPrompt}\n\n## 可用工具\n\n${toolDescriptions}`;
    }

    return systemPrompt;
  }

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

  private getDefaultReasoningPrompt(mode: string): string {
    switch (mode) {
      case ReasoningMode.REACT:
        return `## 推理规则
你是一个能够使用工具的智能助手。请按照以下格式进行思考和操作：

思考：我需要分析当前问题，决定是否需要调用工具。
行动：<工具名称>(<参数>)
结果：工具返回的结果
...（重复）
最终答案：基于所有信息给出最终回答

请仔细思考何时需要调用工具，何时可以直接回答。`;
      case ReasoningMode.PLAN:
        return `## 推理规则
你是一个能够进行规划的智能助手。请按照以下步骤操作：

1. 分析问题，制定详细的执行计划
2. 按照计划逐步执行，调用必要的工具
3. 汇总结果，给出最终答案

请先输出你的计划，然后逐步执行。`;
      case ReasoningMode.REFLECT:
        return `## 推理规则
你是一个具有反思能力的智能助手。在执行过程中，请定期反思：
- 我当前的思路是否正确？
- 是否有更好的方法？
- 是否遗漏了重要信息？

请在每两步操作后进行一次反思。`;
      default:
        return '';
    }
  }
}

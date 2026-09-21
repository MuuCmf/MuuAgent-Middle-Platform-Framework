import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { SubAgentService } from '../sub-agent.service';

/**
 * 子代理调用工具
 *
 * 允许当前智能体调用其他已配置的智能体（子代理）处理专门任务。
 * 子代理使用自己的配置（系统提示词、技能、MCP、知识库、推理模式）独立执行，
 * 最终回复作为本工具的结果返回给父智能体继续处理。
 *
 * 安全护栏（由 SubAgentService 保证）：
 * - 嵌套深度上限（默认 3 层）
 * - 调用链防环（同一智能体不可重复出现）
 * - 单次执行超时（默认 120s）
 * - 结果长度截断（默认 8000 字符）
 * - 应用作用域校验（子代理必须是公共智能体或与父智能体同应用）
 */
@AgentTool({
  name: 'call_agent',
  enabled: true,
  category: 'builtin',
})
export class CallAgentTool extends BaseTool {
  readonly name = 'call_agent';

  readonly definition: ToolDefinition = {
    name: 'call_agent',
    description: `调用其他智能体（子代理）处理专门任务。子代理拥有独立的能力配置（专业技能、知识库、工具），会独立执行任务并返回最终结果。
适用场景：
- 用户任务可以拆分为多个相对独立的子任务，其中部分适合交给更专业的智能体处理（如数据分析、文档撰写、代码审查、深度调研等）；
- 当前智能体不具备完成某任务所需的能力或知识，而另一个已配置的智能体专长于此。

使用要求：
- agent_code 必须是系统中已存在且当前环境可访问的智能体标识；
- query 必须包含完整的任务上下文、明确的目标和期望的输出形式，不要依赖子代理猜测；
- 调用后等待返回结果，再将子代理的结果整合进你的最终回答；不要原样转发问题。
注意：只有当需要另一个智能体专门处理时才调用，不要简单地把当前任务转发出去。`,
    parameters: {
      type: 'object',
      properties: {
        agent_code: {
          type: 'string',
          description: '要调用的子智能体标识（code）',
        },
        query: {
          type: 'string',
          description: '交给子智能体处理的任务描述，需包含完整上下文、明确目标和期望输出形式',
        },
      },
      required: ['agent_code', 'query'],
    },
    type: 'builtin',
  };

  constructor(private readonly subAgentService: SubAgentService) {
    super();
  }

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const agentCode = this.getArg<string>(args, 'agent_code');
    const query = this.getArg<string>(args, 'query');

    if (!agentCode || !query) {
      throw new Error('调用子代理缺少必需参数: agent_code / query');
    }

    const result = await this.subAgentService.run({
      agentCode,
      query,
      chain: context.subAgentChain || [],
      parentCode: context.agent?.code,
      traceId: context.traceId,
      parentAgentId: context.agent?.id,
      parentConversationId: context.parentConversationId,
      isolationContext: context.isolationContext,
      uid: context.uid,
      clientIp: context.clientIp,
    });

    return {
      ok: result.ok,
      response: result.response,
      message: result.message,
    };
  }
}

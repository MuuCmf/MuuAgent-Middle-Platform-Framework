import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { SkillRegistry } from '../../../skill/skill-registry';
import { IsolationContext } from '../../../common/services/base-isolated.service';

/**
 * 技能加载工具
 * 按需加载指定技能的完整指令
 */
@AgentTool({
  name: 'use_skill',
  enabled: true,
  category: 'skill-meta',
})
export class UseSkillTool extends BaseTool {
  readonly name = 'use_skill';

  readonly definition: ToolDefinition = {
    name: 'use_skill',
    description:
      '按需加载指定技能的完整指令。当需要技能的详细操作步骤、API参数格式或执行注意事项时调用此工具。',
    parameters: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: '要加载的技能名称',
        },
      },
      required: ['skill_name'],
    },
    type: 'skill-meta',
  };

  constructor(private readonly skillRegistry: SkillRegistry) {
    super();
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
    const skillName = this.getArg<string>(args, 'skill_name');

    if (!skillName) {
      throw new Error('缺少 skill_name 参数');
    }

    const isoCtx = this.getIsolationContext(context);
    const descriptor = await this.skillRegistry.resolve(skillName, isoCtx);

    if (!descriptor) {
      throw new Error(`技能 "${skillName}" 不存在或不可用`);
    }

    this.logger.log(
      `[use_skill] 加载技能 "${skillName}" 完整指令 (${descriptor.instructions.length} 字符)`,
    );

    const result: Record<string, unknown> = {
      skill_name: skillName,
      source: descriptor.metadata.source,
      instructions: descriptor.instructions,
    };

    if (descriptor.allowedTools && descriptor.allowedTools.length > 0) {
      result.allowed_tools = descriptor.allowedTools;
      if (descriptor.allowedTools.some((t) => ['bash', 'python'].includes(t))) {
        result.hint = `此技能支持脚本执行。使用 run_script 工具并传入 script 参数来运行脚本`;
      }
    }

    if (descriptor.metadata.hasReferences) {
      try {
        const refs = await this.skillRegistry.listReferences(skillName);
        result.available_references = refs;
      } catch {
        /* ignore */
      }
    }

    if (descriptor.executionConfig) {
      result.execution_type = descriptor.executionConfig.type;
    }

    return result;
  }

  /**
   * 获取隔离上下文
   * @param context 工具执行上下文
   */
  private getIsolationContext(context: ToolExecutionContext): IsolationContext {
    if (context.isolationContext) {
      return context.isolationContext;
    }
    return {
      appCode: context.agent.appCode || null,
      isSuperAdmin: false,
    };
  }
}

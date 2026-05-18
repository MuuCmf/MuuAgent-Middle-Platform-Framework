import { Injectable } from '@nestjs/common';
import { IAgentTool, ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { SkillRegistry } from '../../../skill/skill-registry';

@Injectable()
export class LoadReferenceTool implements IAgentTool {
  readonly name = 'load_reference';

  readonly definition: ToolDefinition = {
    name: 'load_reference',
    description: '加载技能的参考文档（references/ 中的文件）。当技能指令中引用了附加文档时使用。',
    parameters: {
      type: 'object',
      properties: {
        skill_name: { type: 'string', description: '技能名称' },
        reference_path: { type: 'string', description: '参考文档的相对路径，如 api-docs.md' },
      },
      required: ['skill_name', 'reference_path'],
    },
    type: 'skill-meta',
  };

  constructor(private readonly skillRegistry: SkillRegistry) {}

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const skillName = args.skill_name as string;
    const referencePath = args.reference_path as string;

    if (!skillName) {
      throw new Error('缺少 skill_name 参数');
    }
    if (!referencePath) {
      throw new Error('缺少 reference_path 参数');
    }

    const content = await this.skillRegistry.loadReference(skillName, referencePath);

    const maxLength = 8000;
    if (content.length > maxLength) {
      return {
        skill_name: skillName,
        reference_path: referencePath,
        content: content.slice(0, maxLength),
        truncated: true,
        total_length: content.length,
      };
    }

    return {
      skill_name: skillName,
      reference_path: referencePath,
      content,
      truncated: false,
    };
  }
}
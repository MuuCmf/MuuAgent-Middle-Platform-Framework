import { Injectable } from '@nestjs/common';
import { IAgentTool, ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { RunScriptTool as BaseRunScriptTool } from '../run-script.tool';

@Injectable()
export class RunScriptTool implements IAgentTool {
  readonly name = 'run_script';

  readonly definition: ToolDefinition = {
    name: 'run_script',
    description: '执行技能预置的脚本（位于技能目录 scripts/ 中）。使用前必须先通过 use_skill 加载技能指令。支持的脚本类型: .js / .py / .sh。',
    parameters: {
      type: 'object',
      properties: {
        skill_name: { type: 'string', description: '技能名称' },
        script: { type: 'string', description: '脚本路径，如 "extract.py"' },
        args: { type: 'object', description: '传递给脚本的参数' },
        timeout: { type: 'number', description: '超时（毫秒），默认 30000' },
      },
      required: ['skill_name', 'script'],
    },
    type: 'skill-meta',
  };

  constructor(private readonly baseRunScriptTool: BaseRunScriptTool) {}

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const skillName = args.skill_name as string;
    const script = args.script as string;

    if (!skillName) {
      throw new Error('缺少 skill_name 参数');
    }
    if (!script) {
      throw new Error('缺少 script 参数');
    }

    return await this.baseRunScriptTool.execute({
      skill_name: skillName,
      script,
      args: args.args as Record<string, string> | undefined,
      timeout: args.timeout as number | undefined,
    });
  }
}
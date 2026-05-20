import { HttpException, HttpStatus } from '@nestjs/common';
import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { SkillRegistry } from '../../../skill/skill-registry';
import { ScriptRunner, ScriptResult } from '../../../skill/standard/script-runner';

/**
 * 脚本执行工具
 * 执行技能预置的脚本（位于技能目录 scripts/ 中）
 */
@AgentTool({
  name: 'run_script',
  enabled: true,
  category: 'skill-meta',
})
export class RunScriptTool extends BaseTool {
  readonly name = 'run_script';

  readonly definition: ToolDefinition = {
    name: 'run_script',
    description:
      '执行技能预置的脚本（位于技能目录 scripts/ 中）。使用前必须先通过 use_skill 加载技能指令。支持的脚本类型: .js / .py / .sh。',
    parameters: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: '技能名称。必须已通过 use_skill 加载',
        },
        script: {
          type: 'string',
          description: '脚本路径（相对于技能 scripts/ 目录），如 "extract.py" 或 "process_data.js"',
        },
        args: {
          type: 'object',
          description: '传递给脚本的参数。JS 通过 params 变量接收；Python/Bash 通过 stdin JSON 接收',
        },
        timeout: { type: 'number', description: '超时（毫秒），默认 30000' },
      },
      required: ['skill_name', 'script'],
    },
    type: 'skill-meta',
  };

  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly scriptRunner: ScriptRunner,
  ) {
    super();
  }

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const skillName = this.getArg<string>(args, 'skill_name');
    const script = this.getArg<string>(args, 'script');
    const scriptArgs = this.getArg<Record<string, string>>(args, 'args', {});
    const timeout = this.getArg<number>(args, 'timeout');

    if (!skillName) {
      throw new Error('缺少 skill_name 参数');
    }
    if (!script) {
      throw new Error('缺少 script 参数');
    }

    const skillDir = this.skillRegistry.getSkillDirectory(skillName);
    if (!skillDir) {
      throw new HttpException(
        `技能 "${skillName}" 不存在或不是文件系统技能`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!this.skillRegistry.hasScripts(skillName)) {
      throw new HttpException(
        `技能 "${skillName}" 没有 scripts/ 目录`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalizedScript = script.replace(/^scripts[\/\\]/, '');

    this.logger.log(`执行技能脚本: ${skillName}/${normalizedScript}`);

    const result: ScriptResult = await this.scriptRunner.run(
      skillDir,
      `scripts/${normalizedScript}`,
      scriptArgs,
      { timeout },
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      duration: result.duration,
      truncated: result.truncated,
    };
  }
}

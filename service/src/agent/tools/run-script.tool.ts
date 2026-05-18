import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SkillRegistry } from '../../skill/skill-registry';
import { StandardSkillExecutor } from '../../skill/standard/standard-skill-executor';
import { ScriptResult } from '../../skill/standard/script-runner';
import { FunctionToolDefinition } from './tool-definitions';

/**
 * 技能脚本执行工具
 *
 * 执行标准技能 scripts/ 目录下的预置脚本。与 run_code 不同，
 * 这些脚本是技能作者预先编写和审计过的，更安全可靠。
 */
@Injectable()
export class RunScriptTool {
  private readonly logger = new Logger(RunScriptTool.name);

  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly standardSkillExecutor: StandardSkillExecutor,
  ) {}

  static readonly definition: FunctionToolDefinition = {
    type: 'function',
    function: {
      name: 'run_script',
      description: `执行技能预置的脚本（位于技能目录 scripts/ 中）。与 run_code 不同，这些脚本是技能作者预先编写和审计过的，更安全可靠。
使用前必须先通过 use_skill 加载技能指令，确认脚本名称和参数。
支持 .js（VM2 沙箱）、.py（Python3）和 .sh（Bash）脚本。`,
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
          timeout: {
            type: 'number',
            description: '超时（毫秒），默认 30000',
          },
        },
        required: ['skill_name', 'script'],
      },
    },
  };

  async execute(
    args: {
      skill_name: string;
      script: string;
      args?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<ScriptResult> {
    const scannerEntry = this.skillRegistry.getScannerEntry(args.skill_name);
    if (!scannerEntry) {
      throw new HttpException(
        `技能 "${args.skill_name}" 不存在或不是文件系统技能`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!scannerEntry.hasScripts) {
      throw new HttpException(
        `技能 "${args.skill_name}" 没有 scripts/ 目录`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`执行技能脚本: ${args.skill_name}/${args.script}`);

    return this.standardSkillExecutor.executeScript(
      scannerEntry.directoryPath,
      `scripts/${args.script}`,
      args.args || {},
      args.timeout,
    );
  }
}

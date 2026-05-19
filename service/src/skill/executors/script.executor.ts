import { Injectable } from '@nestjs/common';
import { IExecutor } from '../interfaces/executor.interface';
import { ScriptRunner } from '../standard/script-runner';

/**
 * 脚本执行器（统一 IExecutor 接口）
 * 包装 ScriptRunner，提供标准化的 canExecute/execute 契约
 */
@Injectable()
export class ScriptExecutor implements IExecutor {
  readonly name = 'script';

  constructor(private readonly scriptRunner: ScriptRunner) {}

  canExecute(toolName: string): boolean {
    return toolName === 'run_script';
  }

  async execute(args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const skillDir = args.skill_dir as string;
    const scriptPath = args.script_path as string;
    const scriptArgs = (args.script_args as Record<string, string>) || {};
    const timeout = args.timeout as number | undefined;

    if (!skillDir || !scriptPath) {
      return { success: false, error: '缺少 skill_dir 或 script_path 参数' };
    }

    try {
      const result = await this.scriptRunner.run(skillDir, scriptPath, scriptArgs, { timeout });
      return {
        success: result.exitCode === 0,
        data: { stdout: result.stdout, stderr: result.stderr, duration: result.duration },
        error: result.exitCode !== 0 ? result.stderr : undefined,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

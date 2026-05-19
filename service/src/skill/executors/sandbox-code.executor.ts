import { Injectable } from '@nestjs/common';
import { IExecutor } from '../interfaces/executor.interface';
import { SandboxExecutor } from './sandbox.executor';

/**
 * 沙箱代码执行器（统一 IExecutor 接口）
 * 包装 SandboxExecutor，提供标准化的 canExecute/execute 契约
 */
@Injectable()
export class SandboxCodeExecutor implements IExecutor {
  readonly name = 'sandbox-code';

  constructor(private readonly sandbox: SandboxExecutor) {}

  canExecute(toolName: string): boolean {
    return toolName === 'run_code';
  }

  async execute(args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const code = args.code as string;
    const params = (args.params as Record<string, unknown>) || {};
    const timeout = (args.timeout as number) || 5000;

    if (!code) {
      return { success: false, error: '缺少 code 参数' };
    }

    return this.sandbox.execute(code, params, timeout);
  }
}

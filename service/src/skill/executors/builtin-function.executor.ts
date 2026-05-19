import { Injectable } from '@nestjs/common';
import { IExecutor } from '../interfaces/executor.interface';
import { BuiltinExecutor } from './builtin.executor';

/**
 * 内置函数执行器（统一 IExecutor 接口）
 * 包装 BuiltinExecutor，提供标准化的 canExecute/execute 契约
 */
@Injectable()
export class BuiltinFunctionExecutor implements IExecutor {
  readonly name = 'builtin-function';

  constructor(private readonly builtin: BuiltinExecutor) {}

  canExecute(toolName: string): boolean {
    return this.builtin.hasFunction(toolName);
  }

  async execute(args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const functionName = args.function_name as string;
    if (!functionName) {
      return { success: false, error: '缺少 function_name 参数' };
    }
    return this.builtin.execute(functionName, args);
  }
}

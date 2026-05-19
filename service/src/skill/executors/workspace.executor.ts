import { Injectable } from '@nestjs/common';
import { IExecutor } from '../interfaces/executor.interface';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';

/**
 * Workspace 工具执行器桩（统一 IExecutor 接口）
 *
 * workspace 工具（read_file, write_file 等）的实际执行在客户端侧，
 * 服务端仅负责识别和标记，此处为接口统一保留占位。
 */
@Injectable()
export class WorkspaceExecutor implements IExecutor {
  readonly name = 'workspace';

  canExecute(toolName: string): boolean {
    return WORKSPACE_TOOL_NAMES.has(toolName);
  }

  async execute(_args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return { success: false, error: 'Workspace 工具需在客户端执行，不应在服务端直接调用' };
  }
}

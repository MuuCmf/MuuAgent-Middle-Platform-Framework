import { IsolationContext } from '../../../common/services/base-isolated.service';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  type: 'builtin' | 'skill-meta' | 'mcp' | 'kb' | 'workspace' | 'system_control' | 'dynamic';
  /** 所属应用标识（动态工具隔离） */
  appCode?: string | null;
  /** 创建者用户ID（动态工具隔离） */
  uid?: string | null;
}

export interface ToolExecutionContext {
  agent: any;
  conversationId?: string;
  uid?: string;
  isolationContext?: IsolationContext;
}

export interface IAgentTool {
  readonly name: string;
  readonly definition: ToolDefinition;
  execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  costMs: number;
}
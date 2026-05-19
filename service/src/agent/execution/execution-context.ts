import { IsolationContext } from '../../common/services/base-isolated.service';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import type { Model } from '@prisma/client';
import type { ModelMessage } from 'ai';

export class ExecutionContext {
  /** Prisma Model 实体，由 ContextBuilder 注入 */
  model: Model;
  /** Agent 实体（来自 Prisma Agent 查询结果），由 ContextBuilder 注入 */
  agent: Record<string, any>;
  /** Conversation 实体（来自 ConversationService），由 ContextBuilder 注入 */
  conversation: Record<string, any>;

  userMessage: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  conversationHistory: ModelMessage[];
  conversationId: string;
  isolationContext: IsolationContext;
  clientIp: string;
  uid?: string;
  appCode?: string;

  startTime: number = Date.now();

  get totalCostMs(): number {
    return Date.now() - this.startTime;
  }
}

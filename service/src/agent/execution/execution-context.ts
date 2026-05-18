import { IsolationContext } from '../../common/services/base-isolated.service';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import type { ModelMessage } from 'ai';

export class ExecutionContext {
  agent: any;
  model: any;
  userMessage: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  conversationHistory: ModelMessage[];
  conversation: any;
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
import { IsolationContext } from '../../common/services/base-isolated.service';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { KbRetrievalConfig, RetrievalResult } from '../types/kb-retrieval.types';
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
  userAgent: string;
  uid?: string;
  appCode?: string;

  /** 知识库检索配置 */
  kbRetrievalConfig: KbRetrievalConfig;

  /** 自动检索结果（如果有） */
  autoRetrievalResult?: RetrievalResult;

  /** 解析后的知识库codes */
  resolvedKbCodes: string[];

  /** 调用链追踪ID（子代理调用时继承父级，用于整条调用链追踪） */
  traceId?: string;

  /** 直接父智能体ID（子代理执行时记录） */
  parentAgentId?: bigint;

  /** 直接父会话ID */
  parentConversationId?: string;

  /** 子代理祖先调用链（不含当前 agent 自身；顶层为空数组） */
  subAgentChain: string[] = [];

  startTime: number = Date.now();

  get totalCostMs(): number {
    return Date.now() - this.startTime;
  }
}

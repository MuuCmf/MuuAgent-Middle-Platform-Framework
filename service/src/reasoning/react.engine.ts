import { Injectable } from '@nestjs/common';
import { ReasoningMode, ReasoningResult } from './types';
import { ExecutionContext } from '../agent/execution/execution-context';
import { StreamEmitter } from '../stream';
import { AiService } from '../ai/ai.service';
import { ConversationService } from '../conversation/conversation.service';
import { ToolExecutor } from '../agent/tools/tool-executor';
import { PrismaService } from '../common/prisma/prisma.service';
import { ClientToolRegistry } from '../client-tool';
import { BaseReasoningEngine } from './base.engine';
import type { ModelMessage } from 'ai';

@Injectable()
export class ReactReasoningEngine extends BaseReasoningEngine {
  readonly mode = ReasoningMode.REACT;

  constructor(
    aiService: AiService,
    conversationService: ConversationService,
    toolExecutor: ToolExecutor,
    prisma: PrismaService,
    clientToolRegistry: ClientToolRegistry,
  ) {
    super(aiService, conversationService, toolExecutor, prisma, clientToolRegistry);
  }

  async executeSync(context: ExecutionContext): Promise<ReasoningResult> {
    this.logger.log(`[ReAct] 开始执行同步模式`);
    return this.executeSyncLoop(context);
  }

  async executeStream(context: ExecutionContext, emitter: StreamEmitter): Promise<void> {
    this.logger.log(`[ReAct] 开始执行流式模式`);
    return this.executeStreamLoop(context, emitter);
  }

  protected pushSyncToolMessages(
    messages: ModelMessage[],
    stepText: string,
    toolCall: { toolCallId?: string; toolName: string; args: Record<string, unknown> },
    resultText: string,
  ): void {
    messages.push({
      role: 'assistant',
      content: [
        { type: 'text', text: stepText || '' },
        {
          type: 'tool-call',
          toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
          toolName: toolCall.toolName,
          args: toolCall.args,
        },
      ],
    } as any);
    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
          toolName: toolCall.toolName,
          result: resultText,
        },
      ],
    } as any);
  }

  protected buildToolResultPrompt(toolName: string, resultText: string): string {
    return `工具 ${toolName} 执行成功，返回结果：
${resultText}

请仔细分析以上结果：
1. 如果结果已经能够回答用户的问题，请直接给出最终答案
2. 如果结果不完整或需要补充信息，请说明原因并继续下一步操作
3. 不要重复调用已经执行过的工具，除非有明确的理由`;
  }
}

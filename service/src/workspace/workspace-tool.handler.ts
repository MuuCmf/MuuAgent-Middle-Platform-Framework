import { Injectable, Logger } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../stream';
import * as crypto from 'crypto';

/**
 * 工作目录工具调用结果
 */
export interface WorkspaceCallResult {
  callId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

@Injectable()
export class WorkspaceToolHandler {
  private readonly logger = new Logger(WorkspaceToolHandler.name);

  /** 等待客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    resolve: (result: WorkspaceCallResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  /**
   * 将工作目录工具调用下发给客户端并等待结果
   */
  async dispatchToClient(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<WorkspaceCallResult> {
    const callId = crypto.randomUUID();

    // 通过 SSE 下发给客户端
    emitter.emit(StreamEvents.workspaceToolCall(callId, toolName, args));

    this.logger.log(`[Workspace] 下发工具调用: ${toolName}, callId: ${callId}`);

    /** 危险操作可能需要用户确认，超时时间设为 60s */
    const timeout = ['delete_file'].includes(toolName) ? 60000 : 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`工作目录操作超时: ${toolName}`));
      }, timeout);

      this.pendingCalls.set(callId, { resolve, reject, timer });
    });
  }

  /**
   * 接收客户端回传的结果
   */
  resolveCall(callId: string, result: WorkspaceCallResult): void {
    const pending = this.pendingCalls.get(callId);
    if (!pending) {
      this.logger.warn(`收到未知 callId 的结果: ${callId}`);
      return;
    }
    clearTimeout(pending.timer);
    this.pendingCalls.delete(callId);
    pending.resolve(result);
  }

  /**
   * 取消所有等待中的调用（流结束时清理）
   */
  cancelPendingCalls(): void {
    for (const [callId, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error('流已结束'));
    }
    this.pendingCalls.clear();
  }
}

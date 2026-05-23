import { Injectable, Logger } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../stream';
import { IClientToolHandler, ClientToolCallResult } from '../client-tool';
import * as crypto from 'crypto';

/** 高危操作工具列表，需要更长超时等待用户确认 */
const HIGH_RISK_TOOLS = ['delete_file', 'shutdown', 'sleep', 'execute_command'];

@Injectable()
export class SystemControlHandler implements IClientToolHandler {
  private readonly logger = new Logger(SystemControlHandler.name);

  /** 等待客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    /** resolve 回调 */
    resolve: (result: ClientToolCallResult) => void;
    /** reject 回调 */
    reject: (error: Error) => void;
    /** 超时定时器 */
    timer: NodeJS.Timeout;
  }>();

  /**
   * 将系统控制工具调用下发给客户端并等待结果
   * @param emitter SSE流发射器
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<ClientToolCallResult>} 执行结果
   */
  async dispatchToClient(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ClientToolCallResult> {
    const callId = crypto.randomUUID();

    emitter.emit(StreamEvents.clientToolCall('system_control', callId, toolName, args));

    this.logger.log(`[SystemControl] 下发工具调用: ${toolName}, callId: ${callId}`);

    /** 高危操作需要用户确认，超时时间设为 60s */
    const timeout = HIGH_RISK_TOOLS.includes(toolName) ? 60000 : 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`系统控制操作超时: ${toolName}`));
      }, timeout);

      this.pendingCalls.set(callId, { resolve, reject, timer });
    });
  }

  /**
   * 接收客户端回传的结果
   * @param callId 调用ID
   * @param result 执行结果
   */
  resolveCall(callId: string, result: ClientToolCallResult): void {
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

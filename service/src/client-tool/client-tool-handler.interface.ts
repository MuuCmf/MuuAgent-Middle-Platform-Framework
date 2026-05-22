import { StreamEmitter } from '../stream';

/**
 * 客户端工具调用结果
 */
export interface ClientToolCallResult {
  /** 调用ID */
  callId: string;
  /** 是否成功 */
  success: boolean;
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * 客户端工具执行调度器接口
 * 负责将工具调用下发给客户端并等待结果回传
 */
export interface IClientToolHandler {
  /**
   * 将工具调用下发给客户端并等待结果
   * @param emitter SSE流发射器
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns {Promise<ClientToolCallResult>} 执行结果
   */
  dispatchToClient(
    emitter: StreamEmitter,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ClientToolCallResult>;

  /**
   * 接收客户端回传的结果
   * @param callId 调用ID
   * @param result 执行结果
   */
  resolveCall(callId: string, result: ClientToolCallResult): void;

  /**
   * 取消所有等待中的调用
   */
  cancelPendingCalls(): void;
}

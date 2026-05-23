import { Injectable, Logger } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../stream';
import { IClientToolHandler, ClientToolCallResult, ClientToolProvider, IClientToolProvider, ClientToolRegistry } from '../client-tool';
import { ClientToolModulePolicy } from '../client-tool/client-tool-entry';
import { WORKSPACE_TOOLS } from './workspace-tool.definitions';
import * as crypto from 'crypto';

/** 工作目录模块默认权限策略 */
const WORKSPACE_DEFAULT_POLICY: ClientToolModulePolicy = {
  moduleName: 'workspace',
  defaultConfirmMode: 'auto',
  defaultTimeout: 30000,
  tools: [
    {
      toolName: 'read_file',
      confirmMode: 'auto',
    },
    {
      toolName: 'write_file',
      confirmMode: 'confirm',
      confirmMessage: '确定要写入文件 {args.path} 吗？',
    },
    {
      toolName: 'append_file',
      confirmMode: 'confirm',
      confirmMessage: '确定要追加内容到文件 {args.path} 吗？',
    },
    {
      toolName: 'create_dir',
      confirmMode: 'auto',
    },
    {
      toolName: 'read_dir',
      confirmMode: 'auto',
    },
    {
      toolName: 'delete_file',
      confirmMode: 'confirm',
      confirmMessage: '确定要删除文件 {args.path} 吗？此操作不可撤销。',
      timeout: 60000,
    },
  ],
};

/**
 * 工作目录工具处理器
 * 使用 @ClientToolProvider 装饰器标记，支持自动发现和注册
 */
@Injectable()
@ClientToolProvider({ name: 'workspace' })
export class WorkspaceToolHandler implements IClientToolHandler, IClientToolProvider {
  private readonly logger = new Logger(WorkspaceToolHandler.name);

  /** 等待客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    resolve: (result: ClientToolCallResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  /**
   * 将工作目录工具调用下发给客户端并等待结果
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

    emitter.emit(StreamEvents.clientToolCall('workspace', callId, toolName, args));

    this.logger.log(`[Workspace] 下发工具调用: ${toolName}, callId: ${callId}`);

    /** 注册 callId → handler 映射，供统一结果回传路由 */
    this.clientToolRegistry.registerCallId(callId, this);

    /** 危险操作可能需要用户确认，超时时间设为 60s */
    const timeout = ['delete_file'].includes(toolName) ? 60000 : 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        this.clientToolRegistry.unregisterCallId(callId);
        reject(new Error(`工作目录操作超时: ${toolName}`));
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
    this.clientToolRegistry.unregisterCallId(callId);
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

  /**
   * 获取客户端工具注册条目
   * 供 ClientToolDiscoveryService 自动发现使用
   * @returns 客户端工具注册条目
   */
  getClientToolEntry() {
    return {
      name: 'workspace',
      toolNames: new Set(WORKSPACE_TOOLS.map(t => t.name)),
      toolDefinitions: WORKSPACE_TOOLS,
      isEnabled: (agent: Record<string, any>) => agent._workspaceEnabled === true,
      eventPrefix: 'WORKSPACE_TOOL',
      handler: this,
      defaultPolicy: WORKSPACE_DEFAULT_POLICY,
    };
  }
}

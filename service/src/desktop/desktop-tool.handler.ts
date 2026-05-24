import { Injectable, Logger } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../stream';
import {
  IClientToolHandler,
  ClientToolCallResult,
  ClientToolProvider,
  IClientToolProvider,
  ClientToolRegistry,
} from '../client-tool';
import { ClientToolModulePolicy } from '../client-tool/client-tool-entry';
import { DESKTOP_TOOLS } from './desktop-tool.definitions';
import * as crypto from 'crypto';

/** 桌面自动化模块默认权限策略 */
const DESKTOP_DEFAULT_POLICY: ClientToolModulePolicy = {
  moduleName: 'desktop',
  defaultConfirmMode: 'auto',
  defaultTimeout: 60000,
  tools: [
    {
      toolName: 'desktop_screenshot',
      confirmMode: 'auto',
    },
    {
      toolName: 'desktop_mouse',
      confirmMode: 'auto',
    },
    {
      toolName: 'desktop_keyboard',
      confirmMode: 'auto',
    },
    {
      toolName: 'desktop_execute',
      confirmMode: 'confirm',
      confirmMessage: '确定要执行命令 {args.command} 吗？',
      timeout: 60000,
    },
    {
      toolName: 'desktop_clipboard',
      confirmMode: 'auto',
    },
    {
      toolName: 'desktop_window',
      confirmMode: 'auto',
    },
  ],
};

/**
 * 桌面自动化工具处理器
 * 实现 IClientToolHandler 接口，通过 SSE 下发工具调用到 Desktop 客户端
 * 使用 @ClientToolProvider 装饰器标记，支持 ClientToolDiscoveryService 自动发现和注册
 */
@Injectable()
@ClientToolProvider({ name: 'desktop' })
export class DesktopToolHandler implements IClientToolHandler, IClientToolProvider {
  private readonly logger = new Logger(DesktopToolHandler.name);

  /** 等待 Desktop 客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    resolve: (result: ClientToolCallResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  /**
   * 将桌面工具调用下发给 Desktop 客户端并等待结果
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

    emitter.emit(StreamEvents.clientToolCall('desktop', callId, toolName, args));

    this.logger.log(`[Desktop] 下发工具调用: ${toolName}, callId: ${callId}`);

    /** 注册 callId → handler 映射，供统一结果回传路由 */
    this.clientToolRegistry.registerCallId(callId, this);

    /** 桌面工具操作超时时间较长，设为 60s */
    const timeout = 60000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        this.clientToolRegistry.unregisterCallId(callId);
        reject(new Error(`桌面工具调用超时: ${toolName}`));
      }, timeout);

      this.pendingCalls.set(callId, { resolve, reject, timer });
    });
  }

  /**
   * 接收 Desktop 客户端回传的结果
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
      name: 'desktop',
      toolNames: new Set(DESKTOP_TOOLS.map(t => t.name)),
      toolDefinitions: DESKTOP_TOOLS,
      isEnabled: (_agent: Record<string, any>) => true,
      eventPrefix: 'DESKTOP_TOOL',
      handler: this,
      defaultPolicy: DESKTOP_DEFAULT_POLICY,
    };
  }
}
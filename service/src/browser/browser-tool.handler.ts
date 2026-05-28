import { Injectable, Logger } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../stream';
import { IClientToolHandler, ClientToolCallResult, ClientToolProvider, IClientToolProvider, ClientToolRegistry } from '../client-tool';
import { ClientToolModulePolicy } from '../client-tool/client-tool-entry';
import { BROWSER_TOOLS } from './browser-tool.definitions';
import * as crypto from 'crypto';

/** 浏览器模块默认权限策略 */
const BROWSER_DEFAULT_POLICY: ClientToolModulePolicy = {
  moduleName: 'browser',
  defaultConfirmMode: 'auto',
  defaultTimeout: 30000,
  tools: [
    {
      toolName: 'browser_navigate',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_screenshot',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_click',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_fill',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_evaluate',
      confirmMode: 'confirm',
      confirmMessage: '⚠️ 确定要执行脚本吗？这可能存在安全风险。',
      timeout: 60000,
    },
    {
      toolName: 'browser_wait',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_scroll',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_get_content',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_select',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_hover',
      confirmMode: 'auto',
    },
    {
      toolName: 'browser_close',
      confirmMode: 'auto',
    },
  ],
};

/**
 * 浏览器工具处理器
 * 使用 @ClientToolProvider 装饰器标记，支持自动发现和注册
 * 与 WorkspaceToolHandler 架构一致，遵循 ClientTool 架构
 */
@Injectable()
@ClientToolProvider({ name: 'browser' })
export class BrowserToolHandler implements IClientToolHandler, IClientToolProvider {
  private readonly logger = new Logger(BrowserToolHandler.name);

  /** 等待客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    resolve: (result: ClientToolCallResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  /**
   * 将浏览器工具调用下发给客户端并等待结果
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

    emitter.emit(StreamEvents.clientToolCall('browser', callId, toolName, args));

    this.logger.log(`[Browser] 下发工具调用: ${toolName}, callId: ${callId}`);

    /** 注册 callId → handler 映射，供统一结果回传路由 */
    this.clientToolRegistry.registerCallId(callId, this);

    /** 危险操作可能需要用户确认，超时时间设为 60s */
    const timeout = ['browser_evaluate', 'browser_navigate'].includes(toolName) ? 60000 : 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        this.clientToolRegistry.unregisterCallId(callId);
        reject(new Error(`浏览器操作超时: ${toolName}`));
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
      name: 'browser',
      toolNames: new Set(BROWSER_TOOLS.map(t => t.name)),
      toolDefinitions: BROWSER_TOOLS,
      isEnabled: (agent: Record<string, any>) => agent._browserEnabled === true,
      eventPrefix: 'BROWSER_TOOL',
      handler: this,
      defaultPolicy: BROWSER_DEFAULT_POLICY,
    };
  }
}
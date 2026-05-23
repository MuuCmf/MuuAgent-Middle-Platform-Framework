import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StreamEmitter, StreamEvents } from '../../stream';
import { IClientToolHandler, ClientToolCallResult, ClientToolProvider, IClientToolProvider, ClientToolRegistry } from '..';
import { ClientToolModulePolicy, ToolPermissionPolicy } from '../client-tool-entry';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';

/** 动态客户端工具模块名称 */
const DYNAMIC_MODULE_NAME = 'dynamic';

/**
 * 缓存的工具定义条目（含隔离字段）
 */
interface CachedToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>;
  /** 确认模式 */
  confirmMode: string;
  /** 确认消息 */
  confirmMessage?: string;
  /** 超时时间 */
  timeout: number;
  /** 所属应用标识 */
  appCode: string | null;
  /** 创建者用户ID */
  uid: string | null;
}

/**
 * 动态客户端工具通用处理器
 *
 * 与 workspace/system_control 等硬编码模块不同，此处理器：
 * 1. 从数据库读取用户注册的工具定义
 * 2. 统一下发到客户端 'dynamic' 模块执行
 * 3. 工具定义和权限策略完全由用户配置，无需服务端代码变更
 *
 * 应用级隔离：通过 appCode + uid 实现工具的可见性隔离
 * - 工具只对同一应用(appCode)下的同一用户(uid)可见
 * - getClientToolEntry 返回全量定义，由 ClientToolRegistry 在 getToolsForAgent 时按 appCode+uid 过滤
 */
@Injectable()
@ClientToolProvider({ name: DYNAMIC_MODULE_NAME })
export class DynamicClientToolHandler implements IClientToolHandler, IClientToolProvider, OnModuleInit {
  private readonly logger = new Logger(DynamicClientToolHandler.name);

  /** 等待客户端回传结果的 Promise 映射 */
  private pendingCalls = new Map<string, {
    /** resolve 函数 */
    resolve: (result: ClientToolCallResult) => void;
    /** reject 函数 */
    reject: (error: Error) => void;
    /** 超时定时器 */
    timer: NodeJS.Timeout;
  }>();

  /** 缓存的工具定义列表（含 appCode/uid 隔离字段） */
  private cachedToolDefinitions: CachedToolDefinition[] = [];

  constructor(
    private readonly clientToolRegistry: ClientToolRegistry,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 模块初始化时加载工具定义
   */
  async onModuleInit(): Promise<void> {
    await this.refreshDefinitions();
  }

  /**
   * 从数据库刷新工具定义缓存
   */
  async refreshDefinitions(): Promise<void> {
    const tools = await this.prisma.dynamicClientTool.findMany({
      where: { enabled: true },
    });

    this.cachedToolDefinitions = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: JSON.parse(tool.parameters),
      confirmMode: tool.confirmMode,
      confirmMessage: tool.confirmMessage || undefined,
      timeout: tool.timeout,
      appCode: tool.appCode,
      uid: tool.uid,
    }));

    this.logger.log(`动态客户端工具定义已刷新: ${this.cachedToolDefinitions.length} 个`);
  }

  /**
   * 根据 appCode + uid 过滤工具定义
   * @param appCode 应用标识
   * @param uid 用户ID
   * @returns {CachedToolDefinition[]} 过滤后的工具定义
   */
  filterByAppCodeAndUid(appCode?: string | null, uid?: string | null): CachedToolDefinition[] {
    return this.cachedToolDefinitions.filter(tool => {
      if (appCode && tool.appCode && tool.appCode !== appCode) return false;
      if (uid && tool.uid && tool.uid !== uid) return false;
      if (!appCode && tool.appCode) return false;
      if (!uid && tool.uid) return false;
      return true;
    });
  }

  /**
   * 将动态工具调用下发给客户端并等待结果
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

    emitter.emit(StreamEvents.clientToolCall(DYNAMIC_MODULE_NAME, callId, toolName, args));

    this.logger.log(`[Dynamic] 下发工具调用: ${toolName}, callId: ${callId}`);

    this.clientToolRegistry.registerCallId(callId, this);

    const toolDef = this.cachedToolDefinitions.find(t => t.name === toolName);
    const timeout = toolDef?.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        this.clientToolRegistry.unregisterCallId(callId);
        reject(new Error(`动态工具调用超时: ${toolName}`));
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
   * 取消所有等待中的调用
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
   * 返回全量工具定义，由 ClientToolRegistry.getToolsForAgent 按 appCode+uid 过滤
   * @returns 客户端工具注册条目
   */
  getClientToolEntry() {
    return {
      name: DYNAMIC_MODULE_NAME,
      toolNames: new Set(this.cachedToolDefinitions.map(t => t.name)),
      toolDefinitions: this.cachedToolDefinitions.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        type: 'dynamic' as const,
        appCode: t.appCode,
        uid: t.uid,
      })),
      isEnabled: () => this.cachedToolDefinitions.length > 0,
      eventPrefix: 'DYNAMIC_TOOL',
      handler: this,
      defaultPolicy: this.buildDefaultPolicy(),
    };
  }

  /**
   * 构建默认权限策略
   * @returns {ClientToolModulePolicy} 权限策略
   */
  private buildDefaultPolicy(): ClientToolModulePolicy {
    return {
      moduleName: DYNAMIC_MODULE_NAME,
      defaultConfirmMode: 'confirm',
      defaultTimeout: 30000,
      tools: this.cachedToolDefinitions.map(t => {
        const policy: ToolPermissionPolicy = {
          toolName: t.name,
          confirmMode: (t.confirmMode as 'auto' | 'confirm' | 'deny') || 'confirm',
        };
        if (t.confirmMessage) {
          policy.confirmMessage = t.confirmMessage;
        }
        return policy;
      }),
    };
  }
}

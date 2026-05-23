import { Injectable, Logger } from '@nestjs/common';
import { ToolDefinition } from '../agent/tools/abstract/tool.interface';
import { ClientToolEntry } from './client-tool-entry';
import { IClientToolHandler } from './client-tool-handler.interface';

/**
 * 客户端工具注册表
 * 核心基础设施，管理所有需要在客户端执行的工具类型
 */
@Injectable()
export class ClientToolRegistry {
  private readonly logger = new Logger(ClientToolRegistry.name);
  /** 已注册的客户端工具条目映射 */
  private entries = new Map<string, ClientToolEntry>();

  /** callId → handler 的映射，用于统一结果回传路由 */
  private callIdToHandler = new Map<string, IClientToolHandler>();

  /**
   * 注册一个客户端工具条目
   * @param entry 工具条目
   */
  register(entry: ClientToolEntry): void {
    this.entries.set(entry.name, entry);
    this.logger.log(`客户端工具已注册: ${entry.name}, 工具: ${[...entry.toolNames].join(', ')}`);
  }

  /**
   * 注册 callId → handler 映射
   * 当 handler 调用 dispatchToClient 生成 callId 时调用
   * @param callId 调用ID
   * @param handler 对应的处理器
   */
  registerCallId(callId: string, handler: IClientToolHandler): void {
    this.callIdToHandler.set(callId, handler);
  }

  /**
   * 注销 callId 映射（结果回传后清理）
   * @param callId 调用ID
   */
  unregisterCallId(callId: string): void {
    this.callIdToHandler.delete(callId);
  }

  /**
   * 根据 callId 查找对应的 handler
   * @param callId 调用ID
   * @returns {IClientToolHandler | undefined} 对应的处理器
   */
  getHandlerByCallId(callId: string): IClientToolHandler | undefined {
    return this.callIdToHandler.get(callId);
  }

  /**
   * 根据工具名称查找对应的注册条目
   * @param toolName 工具名称
   * @returns {ClientToolEntry | undefined} 注册条目
   */
  getEntryByToolName(toolName: string): ClientToolEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.toolNames.has(toolName)) return entry;
    }
    return undefined;
  }

  /**
   * 判断工具是否为客户端执行工具
   * @param toolName 工具名称
   * @returns {boolean}
   */
  isClientTool(toolName: string): boolean {
    return this.getEntryByToolName(toolName) !== undefined;
  }

  /**
   * 获取指定 Agent 可用的所有客户端工具定义
   * @param agent Agent实体
   * @returns {ToolDefinition[]} 工具定义列表
   */
  getToolsForAgent(agent: Record<string, any>): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const entry of this.entries.values()) {
      if (entry.isEnabled(agent)) {
        tools.push(...entry.toolDefinitions);
      }
    }
    return tools;
  }

  /**
   * 获取所有注册条目
   * @returns {ClientToolEntry[]}
   */
  getAllEntries(): ClientToolEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * 根据模块名称获取注册条目
   * @param name 模块名称
   * @returns {ClientToolEntry | undefined} 注册条目
   */
  getEntryByName(name: string): ClientToolEntry | undefined {
    return this.entries.get(name);
  }
}

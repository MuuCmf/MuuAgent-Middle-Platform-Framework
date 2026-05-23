import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from '../tool-registry';
import { McpServerService } from '../../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../../mcp-server/mcp-server-registry';
import { KbSearchTool } from '../builtin/kb-search.tool';
import { BuiltinExecutor } from '../../../skill/executors/builtin.executor';
import { ClientToolRegistry } from '../../../client-tool';
import { ToolExecutionContext } from '../abstract/tool.interface';
import { ToolDispatcher } from '../decorators';

/**
 * 工具分发器接口
 */
export interface IToolDispatcher {
  canHandle(name: string): boolean;
  execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown>;
}

/**
 * 已注册工具分发器
 * 处理通过 ToolRegistry 注册的工具
 */
@Injectable()
@ToolDispatcher({ name: 'registered', order: 10 })
export class RegisteredToolDispatcher implements IToolDispatcher {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  canHandle(name: string): boolean {
    return this.toolRegistry.has(name);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const tool = this.toolRegistry.get(name)!;
    return tool.execute(args, context);
  }
}

/**
 * MCP 工具分发器
 * 处理 MCP 服务器提供的工具
 */
@Injectable()
@ToolDispatcher({ name: 'mcp', order: 20 })
export class McpToolDispatcher implements IToolDispatcher {
  private readonly logger = new Logger(McpToolDispatcher.name);

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
  ) {}

  canHandle(name: string): boolean {
    return name.startsWith('mcp__');
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<unknown> {
    const parts = name.split('__');
    if (parts.length < 3) {
      throw new Error(
        `Invalid MCP tool name format: ${name}. Expected: mcp__serverName__toolName`,
      );
    }

    const serverName = parts[1];
    const toolName = parts.slice(2).join('__');

    const serverConfig = await this.mcpServerRegistry.getServer(serverName);
    if (!serverConfig) {
      throw new Error(`MCP server not found in registry: ${serverName}`);
    }

    return await this.mcpServerService.callToolByName(serverName, toolName, args);
  }
}

/**
 * 知识库搜索分发器
 * 处理 kb_search 工具
 */
@Injectable()
@ToolDispatcher({ name: 'kb', order: 30 })
export class KbSearchDispatcher implements IToolDispatcher {
  constructor(private readonly kbSearchTool: KbSearchTool) {}

  canHandle(name: string): boolean {
    return name === 'kb_search';
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    return await this.kbSearchTool.execute(args, context);
  }
}

/**
 * 客户端工具分发器（通用）
 * 处理所有通过 ClientToolRegistry 注册的客户端工具
 */
@Injectable()
@ToolDispatcher({ name: 'client', order: 40 })
export class ClientToolDispatcher implements IToolDispatcher {
  constructor(private readonly clientToolRegistry: ClientToolRegistry) {}

  canHandle(name: string): boolean {
    return this.clientToolRegistry.isClientTool(name);
  }

  async execute(
    name: string,
    _args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<unknown> {
    throw new Error(`客户端工具 "${name}" 需要在客户端执行，不应在服务端直接调用`);
  }
}

/**
 * 内置函数分发器
 * 处理内置函数调用
 */
@Injectable()
@ToolDispatcher({ name: 'builtin', order: 50 })
export class BuiltinFunctionDispatcher implements IToolDispatcher {
  constructor(private readonly builtinExecutor: BuiltinExecutor) {}

  canHandle(name: string): boolean {
    return this.builtinExecutor.hasFunction(name);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<unknown> {
    const result = await this.builtinExecutor.execute(name, args);
    if (!result.success) {
      throw new Error(result.error || `内置工具 ${name} 执行失败`);
    }
    return result.data;
  }
}

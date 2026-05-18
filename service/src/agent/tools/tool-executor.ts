import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';
import { KbSearchTool } from './kb-search.tool';
import { HttpRequestTool } from './http-request.tool';
import { RunCodeTool } from './run-code.tool';
import { DbQueryTool } from './db-query.tool';
import { RunScriptTool } from './run-script.tool';
import { BuiltinExecutor } from '../../skill/executors/builtin.executor';
import { BUILTIN_TOOL_DEFINITIONS } from './tool-definitions';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { ToolCall, ToolExecutionResult, ToolExecutionContext } from './abstract/tool.interface';
import { SkillKbService } from '../../skill/skill-kb.service';

interface CacheItem {
  result: unknown;
  expireAt: number;
}

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly cache = new Map<string, CacheItem>();
  private readonly defaultCacheTtl = 60000;

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
    private readonly kbSearchTool: KbSearchTool,
    private readonly httpRequestTool: HttpRequestTool,
    private readonly runCodeTool: RunCodeTool,
    private readonly dbQueryTool: DbQueryTool,
    private readonly runScriptTool: RunScriptTool,
    private readonly builtinExecutor: BuiltinExecutor,
    private readonly skillKbService: SkillKbService,
  ) {}

  async executeToolCall(
    toolCall: ToolCall,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const { name, arguments: argsString } = toolCall.function;

    this.logger.log(`[ToolExecutor] 开始执行工具: ${name}`);

    try {
      const args = this.parseArguments(argsString, name);

      const cacheKey = this.buildCacheKey(name, args);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult !== null) {
        this.logger.log(`[ToolExecutor] 使用缓存结果: ${name}`);
        return {
          toolCallId: toolCall.id,
          toolName: name,
          args,
          result: cachedResult,
          success: true,
          costMs: Date.now() - startTime,
        };
      }

      const result = await this.executeTool(name, args, context);

      this.setCache(cacheKey, result);

      const costMs = Date.now() - startTime;
      this.logger.log(`[ToolExecutor] 工具执行成功: ${name}, 耗时: ${costMs}ms`);

      return {
        toolCallId: toolCall.id,
        toolName: name,
        args,
        result,
        success: true,
        costMs,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '工具执行失败';
      const costMs = Date.now() - startTime;

      this.logger.error(`[ToolExecutor] 工具执行失败: ${name}`, errorMsg);

      return {
        toolCallId: toolCall.id,
        toolName: name,
        args: {},
        result: null,
        success: false,
        error: errorMsg,
        costMs,
      };
    }
  }

  async executeToolCalls(
    toolCalls: ToolCall[],
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult[]> {
    this.logger.log(`[ToolExecutor] 开始并行执行 ${toolCalls.length} 个工具`);
    const results = await Promise.all(
      toolCalls.map(tc => this.executeToolCall(tc, context)),
    );
    const successCount = results.filter(r => r.success).length;
    this.logger.log(`[ToolExecutor] 工具执行完成: 成功 ${successCount}/${toolCalls.length}`);
    return results;
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const registeredTool = this.toolRegistry.get(name);
    if (registeredTool) {
      return registeredTool.execute(args, context);
    }

    if (name === 'http_request') {
      return await this.httpRequestTool.execute(args as any);
    }
    if (name === 'run_code') {
      return await this.runCodeTool.execute(args as any);
    }
    if (name === 'db_query') {
      return await this.dbQueryTool.execute(args as any);
    }

    if (name.startsWith('mcp__')) {
      return await this.executeMcpTool(name, args, context);
    }

    if (name === 'kb_search') {
      return await this.executeKbSearch(args, context);
    }

    if (WORKSPACE_TOOL_NAMES.has(name)) {
      throw new Error(`工作目录工具 "${name}" 需要在客户端执行，不应在服务端直接调用`);
    }

    if (BUILTIN_TOOL_DEFINITIONS[name]) {
      return await this.executeBuiltinTool(name, args);
    }

    throw new Error(`未知工具: ${name}`);
  }

  private async executeMcpTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const parts = name.split('__');
    if (parts.length < 3) {
      throw new Error(`Invalid MCP tool name format: ${name}. Expected: mcp__serverName__toolName`);
    }
    
    const serverName = parts[1];
    const toolName = parts.slice(2).join('__');

    const isolationCtx = this.getIsolationContext(context);
    const serverConfig = this.mcpServerRegistry.getServer(serverName, isolationCtx);

    if (!serverConfig) {
      throw new Error(`MCP server not found in registry: ${serverName}`);
    }

    return await this.mcpServerService.callTool([serverConfig], toolName, args);
  }

  private async executeKbSearch(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const isolationCtx = this.getIsolationContext(context);
    const kbCodes = await this.skillKbService.getAgentKbCodes(context.agent.id.toString(), isolationCtx);
    
    return await this.kbSearchTool.execute(context.agent.id, kbCodes, {
      query: args.query as string,
      kb_codes: args.kb_codes as string[] | undefined,
      top_k: args.top_k as number | undefined,
      similarity_threshold: args.similarity_threshold as number | undefined,
    });
  }

  private async executeBuiltinTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await this.builtinExecutor.execute(name, args);
    if (!result.success) {
      throw new Error(result.error || `内置工具 ${name} 执行失败`);
    }
    return result.data;
  }

  private getIsolationContext(context: ToolExecutionContext): IsolationContext {
    if (context.isolationContext) {
      return context.isolationContext;
    }
    return {
      appCode: context.agent.appCode || null,
      isSuperAdmin: false,
    };
  }

  private parseArguments(argsString: string, _toolName: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch {
      this.logger.warn(`[ToolExecutor] 参数解析失败，使用空对象`);
      return {};
    }
  }

  private buildCacheKey(toolName: string, args: Record<string, unknown>): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  private getFromCache(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, result: unknown, ttlMs?: number): void {
    this.cache.set(key, {
      result,
      expireAt: Date.now() + (ttlMs || this.defaultCacheTtl),
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.log('[ToolExecutor] 缓存已清除');
  }

  clearExpiredCache(): void {
    const now = Date.now();
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.expireAt <= now) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(`[ToolExecutor] 清除了 ${count} 个过期缓存`);
    }
  }
}
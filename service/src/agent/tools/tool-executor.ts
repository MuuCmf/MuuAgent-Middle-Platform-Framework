import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry } from '../../skill/skill-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { KbSearchTool } from './kb-search.tool';
import { HttpRequestTool } from './http-request.tool';
import { RunCodeTool } from './run-code.tool';
import { DbQueryTool } from './db-query.tool';
import { RunScriptTool } from './run-script.tool';
import { BuiltinExecutor } from '../../skill/executors/builtin.executor';
import { BUILTIN_TOOL_DEFINITIONS } from './tool-definitions';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { IsolationContext } from '../../common/services/base-isolated.service';

/**
 * 工具调用信息
 */
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  costMs: number;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  agent: any;
  conversationId?: string;
  uid?: string;
  /** 隔离上下文，由调用方传入 */
  isolationContext?: IsolationContext;
}

/**
 * 工具结果缓存项
 */
interface CacheItem {
  result: unknown;
  expireAt: number;
}

/**
 * 工具执行器
 *
 * 负责执行 Function Calling 的工具调用，按工具名路由到对应的处理器。
 *
 * 路由表（按优先级）：
 *   技能元工具:  use_skill / load_reference / run_script
 *   通用能力:    http_request / run_code / db_query
 *   平台工具:    mcp__* / kb_search / workspace / built-in
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly cache = new Map<string, CacheItem>();
  private readonly defaultCacheTtl = 60000;

  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly kbSearchTool: KbSearchTool,
    private readonly httpRequestTool: HttpRequestTool,
    private readonly runCodeTool: RunCodeTool,
    private readonly dbQueryTool: DbQueryTool,
    private readonly runScriptTool: RunScriptTool,
    private readonly builtinExecutor: BuiltinExecutor,
  ) {}

  /**
   * 执行单个工具调用
   */
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

  /**
   * 并行执行多个工具调用
   */
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

  // ============================================================
  // 路由
  // ============================================================

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    // 技能元工具
    if (name === 'use_skill')       return await this.executeUseSkill(args, context);
    if (name === 'load_reference')  return await this.executeLoadReference(args);
    if (name === 'run_script')      return await this.executeRunScript(args, context);

    // 通用能力工具
    if (name === 'http_request')    return await this.httpRequestTool.execute(args as any);
    if (name === 'run_code')        return await this.runCodeTool.execute(args as any);
    if (name === 'db_query')        return await this.dbQueryTool.execute(args as any);

    // MCP 工具
    if (name.startsWith('mcp__'))   return await this.executeMcpTool(name, args, context);

    // 知识库检索
    if (name === 'kb_search')       return await this.executeKbSearch(args, context);

    // 工作目录工具 — 必须由 agent.service.ts 拦截，走到这里是 bug
    if (WORKSPACE_TOOL_NAMES.has(name)) {
      throw new Error(`工作目录工具 "${name}" 需要在客户端执行，不应在服务端直接调用`);
    }

    // 内置工具
    if (BUILTIN_TOOL_DEFINITIONS[name]) {
      return await this.executeBuiltinTool(name, args);
    }

    throw new Error(`未知工具: ${name}`);
  }

  // ============================================================
  // 技能元工具
  // ============================================================

  /**
   * use_skill — 渐进式披露 L1 → L2
   */
  private async executeUseSkill(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const skillName = args.skill_name as string;
    if (!skillName) throw new Error('缺少 skill_name 参数');

    const isoCtx = this.getIsolationContext(context);
    const descriptor = await this.skillRegistry.resolve(skillName, isoCtx);

    if (!descriptor) {
      throw new Error(`技能 "${skillName}" 不存在或不可用`);
    }

    this.logger.log(`[use_skill] 加载技能 "${skillName}" 完整指令 (${descriptor.instructions.length} 字符)`);

    const result: Record<string, unknown> = {
      skill_name: skillName,
      source: descriptor.metadata.source,
      instructions: descriptor.instructions,
    };

    if (descriptor.allowedTools && descriptor.allowedTools.length > 0) {
      result.allowed_tools = descriptor.allowedTools;
      // 如果技能声明了脚本执行能力，提示 LLM 可以使用 run_script
      if (descriptor.allowedTools.some(t => ['bash', 'python'].includes(t))) {
        result.hint = `此技能支持脚本执行。使用 run_script 工具并传入 script 参数来运行脚本`;
      }
    }

    if (descriptor.metadata.hasReferences) {
      try {
        const refs = await this.skillRegistry.listReferences(skillName);
        result.available_references = refs;
      } catch { /* ignore */ }
    }

    if (descriptor.executionConfig) {
      result.execution_type = descriptor.executionConfig.type;
    }

    return result;
  }

  /**
   * load_reference — 渐进式披露 L3
   */
  private async executeLoadReference(
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const skillName = args.skill_name as string;
    const referencePath = args.reference_path as string;

    if (!skillName) throw new Error('缺少 skill_name 参数');
    if (!referencePath) throw new Error('缺少 reference_path 参数');

    const content = await this.skillRegistry.loadReference(skillName, referencePath);

    const maxLength = 8000;
    if (content.length > maxLength) {
      this.logger.warn(`[load_reference] 文档 ${referencePath} 被截断 (${content.length} → ${maxLength} 字符)`);
      return {
        skill_name: skillName,
        reference_path: referencePath,
        content: content.slice(0, maxLength),
        truncated: true,
        total_length: content.length,
      };
    }

    return {
      skill_name: skillName,
      reference_path: referencePath,
      content,
      truncated: false,
    };
  }

  /**
   * run_script — 执行技能 scripts/ 目录下的预置脚本
   */
  private async executeRunScript(
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<unknown> {
    const skillName = args.skill_name as string;
    const script = args.script as string;

    if (!skillName) throw new Error('缺少 skill_name 参数');
    if (!script) throw new Error('缺少 script 参数');

    return await this.runScriptTool.execute({
      skill_name: skillName,
      script,
      args: args.args as Record<string, string> | undefined,
      timeout: args.timeout as number | undefined,
    });
  }

  // ============================================================
  // 平台工具
  // ============================================================

  private async executeMcpTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const parts = name.split('__');
    const serverName = parts[1];
    const toolName = parts.slice(2).join('__');

    const mcpServers = JSON.parse(context.agent.mcpServers || '[]');
    const serverConfig = mcpServers.find((s: any) => s.name === serverName);

    if (!serverConfig) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    return await this.mcpServerService.callTool([serverConfig], toolName, args);
  }

  private async executeKbSearch(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const kbCodes = JSON.parse(context.agent.knowledgeBases || '[]');
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

  // ============================================================
  // 隔离上下文
  // ============================================================

  /**
   * 获取当前请求的隔离上下文
   * 优先使用调用方传入的 isolationContext，否则从 agent 属性回退
   */
  private getIsolationContext(context: ToolExecutionContext): IsolationContext {
    if (context.isolationContext) {
      return context.isolationContext;
    }
    return {
      appCode: context.agent.appCode || null,
      isSuperAdmin: false,
    };
  }

  // ============================================================
  // 缓存 & 参数解析
  // ============================================================

  private parseArguments(argsString: string, toolName: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch {
      this.logger.warn(`[ToolExecutor] 参数解析失败: ${toolName}, 使用空对象`);
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

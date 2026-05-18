import { Injectable, Logger } from '@nestjs/common';
import { SkillService } from '../../skill/skill.service';
import { SkillRegistry } from '../../skill/skill-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { KbSearchTool } from './kb-search.tool';
import { BuiltinExecutor } from '../../skill/executors/builtin.executor';
import { BUILTIN_TOOL_DEFINITIONS } from './tool-definitions';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';

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
 * 负责执行 Function Calling 的工具调用
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly cache = new Map<string, CacheItem>();
  private readonly defaultCacheTtl = 60000; // 默认缓存1分钟

  constructor(
    private readonly skillService: SkillService,
    private readonly skillRegistry: SkillRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly kbSearchTool: KbSearchTool,
    private readonly builtinExecutor: BuiltinExecutor,
  ) {}

  /**
   * 执行单个工具调用
   * @param toolCall 工具调用信息
   * @param context 执行上下文
   * @returns 工具执行结果
   */
  async executeToolCall(
    toolCall: ToolCall,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const { name, arguments: argsString } = toolCall.function;

    this.logger.log(`[ToolExecutor] 开始执行工具: ${name}`);
    this.logger.debug(`[ToolExecutor] 工具参数: ${argsString}`);

    try {
      const args = this.parseArguments(argsString, name);

      // 检查缓存
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

      // 执行工具
      const result = await this.executeTool(name, args, context);

      // 缓存结果
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
   * @param toolCalls 工具调用列表
   * @param context 执行上下文
   * @returns 工具执行结果列表
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
    this.logger.log(
      `[ToolExecutor] 工具执行完成: 成功 ${successCount}/${toolCalls.length}`,
    );

    return results;
  }

  /**
   * 执行具体工具
   * @param name 工具名称
   * @param args 工具参数
   * @param context 执行上下文
   * @returns 工具执行结果
   */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    // 渐进式披露：use_skill（L1 → L2）
    if (name === 'use_skill') {
      return await this.executeUseSkill(args, context);
    }

    // L3：加载参考文档
    if (name === 'load_reference') {
      return await this.executeLoadReference(args);
    }

    if (name.startsWith('skill__')) {
      return await this.executeSkill(name.slice(7), args, context);
    }

    if (name.startsWith('mcp__')) {
      return await this.executeMcpTool(name, args, context);
    }

    if (name === 'kb_search') {
      return await this.executeKbSearch(args, context);
    }

    if (WORKSPACE_TOOL_NAMES.has(name)) {
      throw new Error(`工作目录工具 "${name}" 需要在客户端执行，不应在服务端直接调用。请通过 SSE 流式调用。`);
    }

    if (BUILTIN_TOOL_DEFINITIONS[name]) {
      return await this.executeBuiltinTool(name, args);
    }

    throw new Error(`未知工具: ${name}，支持的类型为 mcp__ / skill__ / kb_search / 内置工具`);
  }

  /**
   * 执行 MCP 工具
   * @param name 工具名称（格式：mcp__serverName__toolName）
   * @param args 工具参数
   * @param context 执行上下文
   * @returns 工具执行结果
   */
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

  /**
   * 执行知识库检索工具
   * @param args 工具参数
   * @param context 执行上下文
   * @returns 检索结果
   */
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

  /**
   * 执行内置工具
   * @param name 工具名称
   * @param args 工具参数
   * @returns 内置工具执行结果
   */
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

  /**
   * 执行技能工具
   * @param skillCode 技能代码
   * @param args 工具参数
   * @param context 执行上下文
   * @returns 技能执行结果
   */
  private async executeSkill(
    skillCode: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    return await this.skillService.execute(
      {
        skillCode,
        params: args,
      },
      { appCode: context.agent.appCode, isSuperAdmin: false },
    );
  }

  /**
   * 执行 use_skill 元工具（渐进式披露 L1 → L2）
   * 按需加载技能的完整指令
   */
  private async executeUseSkill(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const skillName = args.skill_name as string;
    if (!skillName) {
      throw new Error('缺少 skill_name 参数');
    }

    const descriptor = await this.skillRegistry.resolve(
      skillName,
      { appCode: context.agent.appCode, isSuperAdmin: false },
    );

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
   * 执行 load_reference 元工具（渐进式披露 L3）
   * 按需加载技能的参考文档
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
   * 解析工具参数
   * @param argsString 参数字符串
   * @param toolName 工具名称
   * @returns 解析后的参数对象
   */
  private parseArguments(argsString: string, toolName: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch (error) {
      this.logger.warn(`[ToolExecutor] 参数解析失败: ${toolName}, 使用空对象`);
      return {};
    }
  }

  /**
   * 构建缓存键
   * @param toolName 工具名称
   * @param args 工具参数
   * @returns 缓存键
   */
  private buildCacheKey(toolName: string, args: Record<string, unknown>): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  /**
   * 从缓存获取结果
   * @param key 缓存键
   * @returns 缓存结果，如果不存在或已过期则返回 null
   */
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

  /**
   * 设置缓存
   * @param key 缓存键
   * @param result 结果
   * @param ttlMs 缓存时间（毫秒）
   */
  private setCache(key: string, result: unknown, ttlMs?: number): void {
    this.cache.set(key, {
      result,
      expireAt: Date.now() + (ttlMs || this.defaultCacheTtl),
    });
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('[ToolExecutor] 缓存已清除');
  }

  /**
   * 清除过期缓存
   */
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

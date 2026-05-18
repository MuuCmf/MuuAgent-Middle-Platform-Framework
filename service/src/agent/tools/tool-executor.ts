import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';
import { KbSearchTool } from './kb-search.tool';
import { BuiltinExecutor } from '../../skill/executors/builtin.executor';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { IsolationContext } from '../../common/services/base-isolated.service';
import { ToolCall, ToolExecutionResult, ToolExecutionContext } from './abstract/tool.interface';
import { SkillKbService } from '../../skill/skill-kb.service';
import { LruCache, CacheStats } from './utils/lru-cache';

/**
 * 工具缓存配置
 */
interface ToolCacheConfig {
  /** 最大缓存项数量 */
  maxSize: number;
  /** 默认TTL (毫秒) */
  defaultTtl: number;
  /** 是否启用缓存 */
  enabled: boolean;
  /** 不缓存的工具名称列表 */
  excludeTools: string[];
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: ToolCacheConfig = {
  maxSize: 500,
  defaultTtl: 60000,
  enabled: true,
  excludeTools: [
    'run_code',
    'http_request',
    'db_query',
  ],
};

/**
 * 工具执行器
 * 
 * 负责执行各类工具调用，支持：
 * - 注册工具
 * - MCP工具
 * - 知识库搜索
 * - 内置技能
 * 
 * 特性：
 * - LRU缓存机制
 * - 缓存命中率监控
 * - 并行执行
 * - 自动过期清理
 */
@Injectable()
export class ToolExecutor implements OnModuleDestroy {
  private readonly logger = new Logger(ToolExecutor.name);
  
  /** LRU缓存实例 */
  private readonly cache: LruCache<string, unknown>;
  
  /** 缓存配置 */
  private readonly cacheConfig: ToolCacheConfig;

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
    private readonly kbSearchTool: KbSearchTool,
    private readonly builtinExecutor: BuiltinExecutor,
    private readonly skillKbService: SkillKbService,
  ) {
    this.cacheConfig = { ...DEFAULT_CACHE_CONFIG };
    this.cache = new LruCache<string, unknown>({
      maxSize: this.cacheConfig.maxSize,
      defaultTtl: this.cacheConfig.defaultTtl,
      enableStats: true,
      cleanupInterval: 300000,
    });
  }

  /**
   * 模块销毁时清理资源
   */
  onModuleDestroy(): void {
    this.cache.destroy();
    this.logger.log('ToolExecutor 缓存已销毁');
  }

  /**
   * 执行单个工具调用
   * @param toolCall 工具调用信息
   * @param context 执行上下文
   * @returns 执行结果
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

      if (this.shouldUseCache(name)) {
        const cacheKey = this.buildCacheKey(name, args);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult !== undefined) {
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
        this.cache.set(cacheKey, result);

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
      }

      const result = await this.executeTool(name, args, context);
      const costMs = Date.now() - startTime;
      this.logger.log(`[ToolExecutor] 工具执行成功(无缓存): ${name}, 耗时: ${costMs}ms`);

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
   * @returns 执行结果列表
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

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('[ToolExecutor] 缓存已清除');
  }

  /**
   * 手动清理过期缓存
   * @returns 清理的缓存项数量
   */
  cleanupExpiredCache(): number {
    return this.cache.cleanupExpired();
  }

  /**
   * 更新缓存配置
   */
  updateCacheConfig(config: Partial<ToolCacheConfig>): void {
    Object.assign(this.cacheConfig, config);
    this.logger.log(`[ToolExecutor] 缓存配置已更新: ${JSON.stringify(this.cacheConfig)}`);
  }

  /**
   * 获取当前缓存配置
   */
  getCacheConfig(): Readonly<ToolCacheConfig> {
    return { ...this.cacheConfig };
  }

  /**
   * 执行工具
   */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const registeredTool = this.toolRegistry.get(name);
    if (registeredTool) {
      return registeredTool.execute(args, context);
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

    if (this.builtinExecutor.hasFunction(name)) {
      return await this.executeBuiltinTool(name, args);
    }

    throw new Error(`未知工具: ${name}`);
  }

  /**
   * 执行MCP工具
   */
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

    const serverConfig = await this.mcpServerRegistry.getServer(serverName);

    if (!serverConfig) {
      throw new Error(`MCP server not found in registry: ${serverName}`);
    }

    return await this.mcpServerService.callToolByName(serverName, toolName, args);
  }

  /**
   * 执行知识库搜索
   */
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

  /**
   * 执行内置工具
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
   * 获取隔离上下文
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

  /**
   * 解析参数
   */
  private parseArguments(argsString: string, _toolName: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch {
      this.logger.warn(`[ToolExecutor] 参数解析失败，使用空对象`);
      return {};
    }
  }

  /**
   * 构建缓存键
   * 使用稳定的键生成方式
   */
  private buildCacheKey(toolName: string, args: Record<string, unknown>): string {
    const sortedArgs = this.sortObjectKeys(args);
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  }

  /**
   * 递归排序对象键，确保缓存键稳定
   */
  private sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    
    for (const key of keys) {
      sorted[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    
    return sorted;
  }

  /**
   * 判断是否应该使用缓存
   */
  private shouldUseCache(toolName: string): boolean {
    if (!this.cacheConfig.enabled) {
      return false;
    }

    return !this.cacheConfig.excludeTools.includes(toolName);
  }
}

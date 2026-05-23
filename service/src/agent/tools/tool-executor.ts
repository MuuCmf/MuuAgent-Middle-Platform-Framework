import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ToolCall, ToolExecutionResult, ToolExecutionContext } from './abstract/tool.interface';
import { DispatcherCollectorService } from './core/dispatcher-collector.service';
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
 * 使用责任链模式将工具调用分发给对应的 IToolDispatcher。
 * 新增工具类型只需添加一个 Dispatcher，无需修改本类。
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

  constructor(private readonly dispatcherCollector: DispatcherCollectorService) {
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

        const result = await this.dispatch(name, args, context);
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

      const result = await this.dispatch(name, args, context);
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
   * 遍历 dispatcher 链执行工具
   */
  private async dispatch(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const dispatchers = this.dispatcherCollector.getDispatchers();
    for (const d of dispatchers) {
      if (d.canHandle(name)) {
        return d.execute(name, args, context);
      }
    }
    throw new Error(`未知工具: ${name}`);
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

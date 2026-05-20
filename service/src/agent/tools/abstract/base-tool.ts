import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IAgentTool, ToolDefinition, ToolExecutionContext } from './tool.interface';

/**
 * 工具健康检查结果
 */
export interface ToolHealthStatus {
  /** 是否健康 */
  healthy: boolean;
  /** 状态消息 */
  message?: string;
  /** 额外信息 */
  details?: Record<string, unknown>;
}

/**
 * 工具抽象基类
 * 提供统一的工具生命周期管理和通用方法
 *
 * 子类需要实现：
 * - name: 工具名称
 * - definition: 工具定义
 * - execute(): 执行逻辑
 */
export abstract class BaseTool implements IAgentTool, OnModuleInit, OnModuleDestroy {
  protected readonly logger: Logger;

  abstract readonly name: string;
  abstract readonly definition: ToolDefinition;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 执行工具
   * @param args 工具参数
   * @param context 执行上下文
   */
  abstract execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;

  /**
   * 工具初始化钩子
   * 子类可覆盖此方法执行初始化逻辑
   */
  async onModuleInit(): Promise<void> {
    this.logger.debug(`工具 [${this.name}] 已初始化`);
  }

  /**
   * 工具销毁钩子
   * 子类可覆盖此方法执行清理逻辑
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.debug(`工具 [${this.name}] 已销毁`);
  }

  /**
   * 健康检查
   * 子类可覆盖此方法提供自定义健康检查逻辑
   * @returns 健康状态
   */
  async healthCheck(): Promise<ToolHealthStatus> {
    return { healthy: true, message: 'OK' };
  }

  /**
   * 验证必需参数
   * @param args 参数对象
   * @param required 必需参数名列表
   * @throws 缺少必需参数时抛出错误
   */
  protected validateRequired(args: Record<string, unknown>, required: string[]): void {
    for (const key of required) {
      if (args[key] === undefined || args[key] === null) {
        throw new Error(`缺少必需参数: ${key}`);
      }
    }
  }

  /**
   * 获取参数值，支持默认值
   * @param args 参数对象
   * @param key 参数名
   * @param defaultValue 默认值
   * @returns 参数值
   */
  protected getArg<T>(args: Record<string, unknown>, key: string, defaultValue?: T): T {
    return (args[key] as T) ?? defaultValue as T;
  }
}

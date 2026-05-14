import { Model } from '@prisma/client';
import {
  ExecutionParams,
  ExecutionResult,
  StreamChunk,
  ToolCall,
} from '../interfaces/executor.interface';

/**
 * Provider 策略接口
 * 每个提供商实现自己的策略
 */
export interface IProviderStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 支持的 Provider 标识
   */
  readonly providerId: string;

  /**
   * 创建 SDK provider 实例
   * @param model 模型配置
   * @returns SDK provider 实例
   */
  createProvider(model: Model): ReturnType<typeof import('@ai-sdk/openai').createOpenAI>;

  /**
   * 执行同步调用
   * @param params 执行参数
   * @returns 执行结果
   */
  execute(params: ExecutionParams): Promise<ExecutionResult>;

  /**
   * 执行流式调用
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  stream(params: ExecutionParams): AsyncIterable<StreamChunk>;

  /**
   * 解析工具调用（可选）
   * 某些 Provider 可能使用特殊的工具调用格式
   * @param response 原始响应
   * @returns 工具调用或 null
   */
  parseToolCall?(response: unknown): ToolCall | null;

  /**
   * 获取模型名称
   * 某些 Provider 可能需要特殊处理模型名称
   * @param model 模型配置
   * @returns 模型名称
   */
  getModelName?(model: Model): string;
}

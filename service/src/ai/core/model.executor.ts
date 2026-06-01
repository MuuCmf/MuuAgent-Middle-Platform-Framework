import { Injectable, Logger } from '@nestjs/common';
import {
  IModelExecutor,
  ExecutionParams,
  ExecutionResult,
  StreamChunk,
} from '../interfaces/executor.interface';
import {
  OmniExecutionParams,
  OmniExecutionResult,
} from '../strategies/provider.strategy.interface';
import { StrategyFactory } from '../strategies/strategy.factory';
import { LogService } from '../infrastructure/log.service';
import { ModelRoutingService } from '../../model-routing/model-routing.service';
import { ErrorHandler } from '../handlers/error.handler';

/**
 * 模型执行器
 * 统一管理模型调用的执行流程
 */
@Injectable()
export class ModelExecutor implements IModelExecutor {
  private readonly logger = new Logger(ModelExecutor.name);

  /**
   * 构造函数
   * @param strategyFactory 策略工厂
   * @param logService 日志服务
   * @param mcpService MCP 服务
   * @param errorHandler 错误处理器
   */
  constructor(
    private readonly strategyFactory: StrategyFactory,
    private readonly logService: LogService,
    private readonly mcpService: ModelRoutingService,
    private readonly errorHandler: ErrorHandler,
  ) {}

  /**
   * 执行 Omni 同步调用
   * 支持多模态输入输出的全能模型
   * 
   * @param params Omni 执行参数
   * @returns Omni 执行结果
   */
  async executeOmni(params: OmniExecutionParams): Promise<OmniExecutionResult> {
    const { model, context } = params;

    this.logger.debug(
      `[${context.requestId}] 开始执行 Omni 同步调用: model=${model.code}, provider=${model.provider}`
    );

    const strategy = this.strategyFactory.getStrategy(model.provider);

    if (!strategy.executeOmni) {
      throw new Error(`Provider ${model.provider} 不支持 Omni 模型调用`);
    }

    try {
      const result = await strategy.executeOmni(params);

      this.logger.debug(
        `[${context.requestId}] Omni 同步调用完成: tokens=${result.usage?.totalTokens}`
      );

      return result;
    } catch (error) {
      await this.errorHandler.handle(error, { model, context } as any);
      throw error;
    }
  }

  /**
   * 执行 Omni 流式调用
   * 
   * @param params Omni 执行参数
   * @returns 流式响应块迭代器
   */
  async *streamOmni(params: OmniExecutionParams): AsyncIterable<StreamChunk> {
    const { model, context } = params;

    this.logger.debug(
      `[${context.requestId}] 开始执行 Omni 流式调用: model=${model.code}, provider=${model.provider}`
    );

    const strategy = this.strategyFactory.getStrategy(model.provider);

    if (!strategy.streamOmni) {
      throw new Error(`Provider ${model.provider} 不支持 Omni 流式调用`);
    }

    try {
      for await (const chunk of strategy.streamOmni(params)) {
        yield chunk;
      }

      this.logger.debug(`[${context.requestId}] Omni 流式调用完成`);
    } catch (error) {
      await this.errorHandler.handle(error, { model, context } as any);

      yield {
        type: 'error',
        error: {
          message: error instanceof Error ? error.message : '未知错误',
        },
      };
    }
  }

  /**
   * 执行同步调用
   * @param params 执行参数
   * @returns 执行结果
   */
  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { model, context } = params;

    this.logger.debug(
      `[${context.requestId}] 开始执行同步调用: model=${model.code}, provider=${model.provider}`
    );

    const strategy = this.strategyFactory.getStrategy(model.provider);

    try {
      const result = await strategy.execute(params);

      await this.logService.logSuccess(params, result);

      this.logger.debug(
        `[${context.requestId}] 同步调用完成: tokens=${result.usage?.totalTokens}`
      );

      return result;
    } catch (error) {
      await this.errorHandler.handle(error, params);
      throw error;
    }
  }

  /**
   * 执行流式调用
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  async *stream(params: ExecutionParams): AsyncIterable<StreamChunk> {
    const { model, context } = params;

    this.logger.debug(
      `[${context.requestId}] 开始执行流式调用: model=${model.code}, provider=${model.provider}`
    );

    const strategy = this.strategyFactory.getStrategy(model.provider);

    try {
      for await (const chunk of strategy.stream(params)) {
        yield chunk;
      }

      this.logger.debug(`[${context.requestId}] 流式调用完成`);
    } catch (error) {
      await this.errorHandler.handle(error, params);

      yield {
        type: 'error',
        error: {
          message: error instanceof Error ? error.message : '未知错误',
        },
      };
    }
  }

  /**
   * 执行同步调用（带并发控制）
   * @param params 执行参数
   * @returns 执行结果
   */
  async executeWithConcurrency(params: ExecutionParams): Promise<ExecutionResult> {
    const { model } = params;

    await this.mcpService.checkCircuit(model.id as any);
    await this.mcpService.checkConcurrency(model.id as any);

    try {
      const result = await this.execute(params);
      return result;
    } finally {
      await this.mcpService.releaseConcurrency(model.id as any);
    }
  }

  /**
   * 执行流式调用（带并发控制）
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  async *streamWithConcurrency(params: ExecutionParams): AsyncIterable<StreamChunk> {
    const { model } = params;

    await this.mcpService.checkCircuit(model.id as any);
    await this.mcpService.checkConcurrency(model.id as any);

    try {
      for await (const chunk of this.stream(params)) {
        yield chunk;
      }
    } finally {
      await this.mcpService.releaseConcurrency(model.id as any);
    }
  }
}

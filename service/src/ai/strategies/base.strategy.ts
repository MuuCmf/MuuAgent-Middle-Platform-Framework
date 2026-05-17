import { Logger } from '@nestjs/common';
import { Model } from '@prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type { GenerateTextResult } from 'ai';
import {
  IProviderStrategy,
} from './provider.strategy.interface';
import {
  ExecutionParams,
  ExecutionResult,
  StreamChunk,
} from '../interfaces/executor.interface';
import { resolveBaseUrl, getProviderConfig } from '../providers/provider-registry';

/**
 * 基础策略
 * 提供所有 OpenAI 兼容 Provider 的通用实现
 */
export abstract class BaseStrategy implements IProviderStrategy {
  protected readonly logger: Logger;

  /**
   * 构造函数
   */
  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 策略名称（由子类实现）
   */
  abstract readonly name: string;

  /**
   * 支持的 Provider 标识（由子类实现）
   */
  abstract readonly providerId: string;

  /**
   * 创建 OpenAI SDK provider 实例
   * @param model 模型配置
   * @returns SDK provider 实例
   */
  createProvider(model: Model): ReturnType<typeof createOpenAI> {
    const config = getProviderConfig(this.providerId);
    const baseURL = resolveBaseUrl(model);

    this.logger.debug(
      `创建 provider: provider=${this.providerId}, baseURL=${baseURL}, hasApiKey=${!!model.apiKey}`
    );

    return createOpenAI({
      apiKey: model.apiKey || (config.requireApiKey ? process.env.OPENAI_API_KEY : 'empty'),
      ...(baseURL ? { baseURL } : {}),
    });
  }

  /**
   * 获取模型名称
   * @param model 模型配置
   * @returns 模型名称
   */
  getModelName(model: Model): string {
    return model.code || 'gpt-4';
  }

  /**
   * 执行同步调用
   * @param params 执行参数
   * @returns 执行结果
   */
  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { model, system, messages, tools, options } = params;
    const provider = this.createProvider(model);
    const modelName = this.getModelName(model);

    this.logger.debug(`执行同步调用: modelName=${modelName}`);

    const result = await generateText({
      model: provider.chat(modelName),
      system,
      messages,
      tools: tools && Object.keys(tools).length > 0 ? tools : undefined,
      toolChoice: options?.toolChoice,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
    } as any);

    return this.transformResult(result);
  }

  /**
   * 执行流式调用
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  async *stream(params: ExecutionParams): AsyncIterable<StreamChunk> {
    const { model, system, messages, tools, options } = params;
    const provider = this.createProvider(model);
    const modelName = this.getModelName(model);

    this.logger.debug(`执行流式调用: modelName=${modelName}`);

    const streamResult = streamText({
      model: provider.chat(modelName),
      system,
      messages,
      tools: tools && Object.keys(tools).length > 0 ? tools : undefined,
      toolChoice: options?.toolChoice,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
    } as any);

    for await (const part of streamResult.fullStream) {
      yield this.transformStreamPart(part);
    }
  }

  /**
   * 转换执行结果
   * @param result 原始结果
   * @returns 统一结果
   */
  protected transformResult(result: GenerateTextResult<any, any>): ExecutionResult {
    const usage = result.usage as any;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const toolCalls = result.toolCalls as Array<Record<string, unknown>> | undefined;

    return {
      content: result.text as string,
      finishReason: (result.finishReason as string) || 'stop',
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      toolCalls: toolCalls?.map((tc) => ({
        toolCallId: tc.toolCallId as string,
        toolName: tc.toolName as string,
        args: (tc.args as Record<string, unknown>) || {},
      })),
      steps: result.steps as any[],
      raw: result,
    };
  }

  /**
   * 转换流式响应部分
   * @param part 原始部分
   * @returns 统一流式块
   */
  protected transformStreamPart(part: Record<string, unknown>): StreamChunk {
    const type = part.type as string;

    switch (type) {
      case 'text-delta':
        return {
          type: 'text-delta',
          delta: part.text as string,
        };

      case 'tool-call': {
        const rawInput = part.input;
        let args: Record<string, unknown>;
        if (typeof rawInput === 'string') {
          try {
            args = JSON.parse(rawInput);
          } catch {
            args = {};
          }
        } else if (rawInput && typeof rawInput === 'object') {
          args = rawInput as Record<string, unknown>;
        } else {
          args = {};
        }
        return {
          type: 'tool-call',
          toolCall: {
            toolCallId: part.toolCallId as string,
            toolName: part.toolName as string,
            args,
          },
        };
      }

      case 'finish': {
        const totalUsage = part.totalUsage as Record<string, number> | undefined;
        return {
          type: 'finish',
          finish: {
            reason: part.finishReason as string,
            usage: totalUsage
              ? {
                  promptTokens: totalUsage.inputTokens ?? 0,
                  completionTokens: totalUsage.outputTokens ?? 0,
                  totalTokens:
                    (totalUsage.inputTokens ?? 0) +
                    (totalUsage.outputTokens ?? 0),
                }
              : undefined,
          },
        };
      }

      default:
        return { type: 'text-delta', delta: '' };
    }
  }
}

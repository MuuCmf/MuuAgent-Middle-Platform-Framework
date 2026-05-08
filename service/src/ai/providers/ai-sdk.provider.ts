import { Injectable, Logger } from '@nestjs/common';
import { Model } from '@prisma/client';
import { ModelService } from '../../model/model.service';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, type ModelMessage, type Tool } from 'ai';

/**
 * AI SDK 模型提供者
 * 将现有的 Model 配置适配到 Vercel AI SDK v3
 */
@Injectable()
export class AiSdkProvider {
  private readonly logger = new Logger(AiSdkProvider.name);

  constructor(private readonly modelService: ModelService) {}

  /**
   * 创建 AI SDK provider 实例
   * @param model 模型配置
   * @returns AI SDK provider
   */
  createProvider(model: Model): ReturnType<typeof createOpenAI> {
    const provider = model.provider?.toLowerCase();
    const endpoint = model.endpoint;
    const apiKey = model.apiKey;

    this.logger.debug(`创建 provider: provider=${provider}, endpoint=${endpoint}, hasApiKey=${!!apiKey}`);

    switch (provider) {
      case 'openai':
        return createOpenAI({
          apiKey: apiKey || process.env.OPENAI_API_KEY,
        });

      case 'ollama':
        return createOpenAI({
          apiKey: 'empty',
          baseURL: this.normalizeOllamaURL(endpoint || 'http://localhost:11434'),
        });

      case 'azure':
        return createOpenAI({
          apiKey: apiKey ?? undefined,
          baseURL: `${endpoint}/openai/deployments/${model.code}`,
        });

      case 'zhipu':
        return createOpenAI({
          apiKey: apiKey ?? undefined,
          baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
        });

      case 'deepseek':
        return createOpenAI({
          apiKey: apiKey ?? undefined,
          baseURL: 'https://api.deepseek.com/v1',
        });

      case 'custom':
        return createOpenAI({
          apiKey: apiKey ?? 'empty',
          baseURL: endpoint,
        });

      default:
        this.logger.warn(`Unknown provider: ${provider}, falling back to OpenAI compatible`);
        return createOpenAI({
          apiKey: apiKey || process.env.OPENAI_API_KEY,
        });
    }
  }

  /**
   * 规范化 Ollama URL
   */
  private normalizeOllamaURL(endpoint: string): string {
    if (!endpoint) {
      return 'http://localhost:11434';
    }
    if (endpoint.endsWith('/api/chat')) {
      return endpoint.replace('/api/chat', '');
    }
    if (endpoint.endsWith('/chat')) {
      return endpoint.replace('/chat', '');
    }
    return endpoint;
  }

  /**
   * 获取模型名称
   * @param model 模型配置
   * @returns 模型名称
   */
  getModelName(model: Model): string {
    const provider = model.provider?.toLowerCase();

    switch (provider) {
      case 'openai':
        return model.code || 'gpt-4';

      case 'ollama':
        return model.code || 'llama3';

      case 'azure':
        return model.code || 'gpt-4';

      case 'zhipu':
        return model.code || 'glm-4';

      case 'deepseek':
        return model.code || 'deepseek-chat';

      case 'custom':
        return model.code || 'custom-model';

      default:
        return model.code || 'gpt-4';
    }
  }

  /**
   * 执行 generateText（同步调用）
   */
  async generateText(params: {
    model: Model;
    system?: string;
    messages: ModelMessage[];
    tools?: Record<string, Tool>;
    toolChoice?: any;
    temperature?: number;
    maxTokens?: number;
    onStepFinish?: (step: any) => void;
  }): Promise<{
    text: string;
    finishReason: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    steps?: any[];
  }> {
    const provider = this.createProvider(params.model);
    const modelName = this.getModelName(params.model);

    this.logger.debug(`generateText: modelName=${modelName}, temperature=${params.temperature}, toolsCount=${params.tools ? Object.keys(params.tools).length : 0}`);

    const tools = params.tools && Object.keys(params.tools).length > 0 ? params.tools : undefined;

    const result = await generateText({
      model: provider.chat(modelName),
      system: params.system,
      messages: params.messages,
      tools,
      toolChoice: params.toolChoice,
      temperature: params.temperature ?? params.model.temperature ?? 0.7,
      onStepFinish: params.onStepFinish,
    });

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;

    return {
      text: result.text,
      finishReason: result.finishReason || 'stop',
      usage: result.usage
        ? {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
          }
        : undefined,
      steps: result.steps,
    };
  }

  /**
   * 执行 streamText（流式调用）
   */
  async streamText(params: {
    model: Model;
    system?: string;
    messages: ModelMessage[];
    tools?: Record<string, Tool>;
    toolChoice?: any;
    temperature?: number;
    maxTokens?: number;
    onChunk?: (chunk: string) => void;
    onToolCall?: (toolCall: { name: string; args: any }) => void;
    onFinish?: (result: any) => void;
    onError?: (error: any) => void;
  }): Promise<void> {
    const provider = this.createProvider(params.model);
    const modelName = this.getModelName(params.model);

    this.logger.debug(`streamText: modelName=${modelName}, temperature=${params.temperature}, toolsCount=${params.tools ? Object.keys(params.tools).length : 0}`);

    const tools = params.tools && Object.keys(params.tools).length > 0 ? params.tools : undefined;

    try {
      this.logger.debug('开始调用 streamText...');

      const streamResult = streamText({
        model: provider.chat(modelName),
        system: params.system,
        messages: params.messages,
        tools,
        toolChoice: params.toolChoice,
        temperature: params.temperature ?? params.model.temperature ?? 0.7,
      });

      this.logger.debug('streamText 调用完成，开始迭代 fullStream...');

      let fullText = '';
      let finishReason: string | undefined;
      let usage: any;
      let toolCalls: any[] = [];

      for await (const part of streamResult.fullStream) {
        // this.logger.debug(`stream part: type=${part.type}`);
        if (part.type === 'text-delta' && params.onChunk) {
          fullText += part.text;
          params.onChunk(part.text);
        } else if (part.type === 'tool-call') {
          toolCalls.push(part);
          this.logger.debug(`tool call detected: ${JSON.stringify(part)}`);
          this.logger.debug(`tool call keys: ${Object.keys(part).join(', ')}`);
          this.logger.debug(`tool call has name property: ${'name' in part}, has args property: ${'args' in part}`);
        } else if (part.type === 'finish') {
          finishReason = part.finishReason;
          usage = part.totalUsage;
          this.logger.debug(`stream finish: finishReason=${finishReason}`);
        }
      }

      this.logger.debug(`stream 完成: fullText.length=${fullText.length}, toolCalls.length=${toolCalls.length}`);

      if (finishReason === 'tool-calls' && toolCalls.length > 0 && params.onToolCall) {
        for (const toolCall of toolCalls) {
          if (toolCall.toolName && params.onToolCall) {
            params.onToolCall({
              name: toolCall.toolName,
              args: toolCall.input || {},
            });
          }
        }
      }

      if (params.onFinish) {
        params.onFinish({
          text: fullText,
          finishReason,
          usage,
          toolCalls,
        });
      }
    } catch (error) {
      this.logger.error(`streamText error: ${error?.message || error}`);
      this.logger.error(`streamText error stack: ${error?.stack || 'no stack'}`);
      if (params.onError) {
        params.onError(error);
      }
    }
  }
}
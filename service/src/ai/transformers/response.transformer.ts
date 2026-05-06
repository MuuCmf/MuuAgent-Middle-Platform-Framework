import { Injectable } from '@nestjs/common';
import { Model } from '@prisma/client';
import {
  UnifiedAiResponse,
  UnifiedEmbeddingResponse,
  UnifiedImageResponse,
  UnifiedStreamChunk,
} from '../interfaces/unified-response.interface';

/**
 * 响应格式转换器
 * 将不同厂商的响应转换为统一格式
 */
@Injectable()
export class ResponseTransformer {
  /**
   * 转换AI响应为统一格式
   * @param provider 提供商
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedAiResponse} 统一响应
   */
  transformAiResponse(
    provider: string,
    model: Model,
    response: any,
  ): UnifiedAiResponse {
    const providerLower = provider.toLowerCase();

    switch (providerLower) {
      case 'ollama':
        return this.transformOllamaResponse(model, response);
      case 'zhipu':
        return this.transformZhipuResponse(model, response);
      case 'deepseek':
        return this.transformDeepSeekResponse(model, response);
      default:
        return this.transformOpenAICompatibleResponse(model, response);
    }
  }

  /**
   * 转换Ollama响应
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedAiResponse} 统一响应
   */
  private transformOllamaResponse(model: Model, response: any): UnifiedAiResponse {
    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model.code,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.message?.content || response.response || '',
          },
          finish_reason: response.done ? 'stop' : null,
        },
      ],
      usage: response.eval_count
        ? {
            prompt_tokens: response.prompt_eval_count || 0,
            completion_tokens: response.eval_count || 0,
            total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
          }
        : undefined,
      provider: 'ollama',
    };
  }

  /**
   * 转换智谱AI响应
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedAiResponse} 统一响应
   */
  private transformZhipuResponse(model: Model, response: any): UnifiedAiResponse {
    return {
      id: response.id || `zhipu-${Date.now()}`,
      object: 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: model.code,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.choices?.[0]?.message?.content || '',
          },
          finish_reason: response.choices?.[0]?.finish_reason || null,
        },
      ],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            completion_tokens: response.usage.completion_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          }
        : undefined,
      provider: 'zhipu',
    };
  }

  /**
   * 转换DeepSeek响应
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedAiResponse} 统一响应
   */
  private transformDeepSeekResponse(model: Model, response: any): UnifiedAiResponse {
    return {
      id: response.id || `deepseek-${Date.now()}`,
      object: 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: model.code,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.choices?.[0]?.message?.content || '',
          },
          finish_reason: response.choices?.[0]?.finish_reason || null,
        },
      ],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            completion_tokens: response.usage.completion_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          }
        : undefined,
      provider: 'deepseek',
    };
  }

  /**
   * 转换OpenAI兼容响应
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedAiResponse} 统一响应
   */
  private transformOpenAICompatibleResponse(
    model: Model,
    response: any,
  ): UnifiedAiResponse {
    return {
      id: response.id || `openai-${Date.now()}`,
      object: response.object || 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: model.code,
      choices: response.choices?.map((choice: any, index: number) => ({
        index,
        message: {
          role: choice.message?.role || 'assistant',
          content: choice.message?.content || '',
        },
        finish_reason: choice.finish_reason || null,
      })) || [],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            completion_tokens: response.usage.completion_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          }
        : undefined,
      provider: model.provider,
    };
  }

  /**
   * 转换Embedding响应
   * @param provider 提供商
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedEmbeddingResponse} 统一响应
   */
  transformEmbeddingResponse(
    provider: string,
    model: Model,
    response: any,
  ): UnifiedEmbeddingResponse {
    const providerLower = provider.toLowerCase();

    if (providerLower === 'ollama') {
      return {
        object: 'list',
        data: [
          {
            object: 'embedding',
            index: 0,
            embedding: response.embedding || [],
          },
        ],
        model: model.code,
        usage: {
          prompt_tokens: response.prompt_eval_count || 0,
          completion_tokens: 0,
          total_tokens: response.prompt_eval_count || 0,
        },
      };
    }

    return {
      object: response.object || 'list',
      data: response.data || [],
      model: model.code,
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  /**
   * 转换图片生成响应
   * @param provider 提供商
   * @param model 模型信息
   * @param response 原始响应
   * @returns {UnifiedImageResponse} 统一响应
   */
  transformImageResponse(
    provider: string,
    model: Model,
    response: any,
  ): UnifiedImageResponse {
    return {
      created: response.created || Math.floor(Date.now() / 1000),
      data: response.data?.map((item: any) => ({
        url: item.url,
        b64_json: item.b64_json,
      })) || [],
    };
  }

  /**
   * 转换流式响应块
   * @param provider 提供商
   * @param model 模型信息
   * @param chunk 原始响应块
   * @returns {UnifiedStreamChunk | null} 统一响应块
   */
  transformStreamChunk(
    provider: string,
    model: Model,
    chunk: string,
  ): UnifiedStreamChunk | null {
    try {
      if (chunk.startsWith('data: [DONE]')) {
        return null;
      }

      if (chunk.startsWith('data: ')) {
        const data = JSON.parse(chunk.substring(6));
        const providerLower = provider.toLowerCase();

        if (providerLower === 'ollama') {
          return this.transformOllamaStreamChunk(model, data);
        }

        return this.transformOpenAIStreamChunk(model, data);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 转换Ollama流式响应块
   * @param model 模型信息
   * @param data 响应数据
   * @returns {UnifiedStreamChunk} 统一响应块
   */
  private transformOllamaStreamChunk(
    model: Model,
    data: any,
  ): UnifiedStreamChunk {
    return {
      id: `ollama-stream-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model.code,
      choices: [
        {
          index: 0,
          delta: {
            content: data.message?.content || data.response || '',
          },
          finish_reason: data.done ? 'stop' : null,
        },
      ],
    };
  }

  /**
   * 转换OpenAI流式响应块
   * @param model 模型信息
   * @param data 响应数据
   * @returns {UnifiedStreamChunk} 统一响应块
   */
  private transformOpenAIStreamChunk(
    model: Model,
    data: any,
  ): UnifiedStreamChunk {
    return {
      id: data.id || `stream-${Date.now()}`,
      object: data.object || 'chat.completion.chunk',
      created: data.created || Math.floor(Date.now() / 1000),
      model: model.code,
      choices: data.choices?.map((choice: any) => ({
        index: choice.index || 0,
        delta: {
          role: choice.delta?.role,
          content: choice.delta?.content || '',
        },
        finish_reason: choice.finish_reason || null,
      })) || [],
    };
  }
}

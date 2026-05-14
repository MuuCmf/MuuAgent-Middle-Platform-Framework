import { Injectable } from '@nestjs/common';
import { Model } from '@prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { BaseStrategy } from './base.strategy';
import { getProviderConfig } from '../providers/provider-registry';

/**
 * Ollama 策略
 * 处理 Ollama 本地模型的调用
 */
@Injectable()
export class OllamaStrategy extends BaseStrategy {
  readonly name = 'Ollama';
  readonly providerId = 'ollama';

  /**
   * 创建 Ollama provider 实例
   * 覆盖父类方法，处理 Ollama 特殊的 baseURL
   * @param model 模型配置
   * @returns SDK provider 实例
   */
  createProvider(model: Model): ReturnType<typeof createOpenAI> {
    const config = getProviderConfig(this.providerId);
    const baseURL = config.normalizeBaseUrl?.(model.endpoint || config.defaultBaseUrl) 
                    || config.defaultBaseUrl;

    this.logger.debug(`创建 Ollama provider: baseURL=${baseURL}`);

    return createOpenAI({
      apiKey: 'ollama',
      baseURL,
    });
  }

  /**
   * 获取模型名称
   * 覆盖父类方法，提供 Ollama 默认模型名
   * @param model 模型配置
   * @returns 模型名称
   */
  getModelName(model: Model): string {
    return model.code || 'llama2';
  }
}

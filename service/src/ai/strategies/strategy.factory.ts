import { Injectable, Logger } from '@nestjs/common';
import { IProviderStrategy } from './provider.strategy.interface';
import { OpenAIStrategy } from './openai.strategy';
import { ZhipuStrategy } from './zhipu.strategy';
import { DeepSeekStrategy } from './deepseek.strategy';
import { OllamaStrategy } from './ollama.strategy';
import { AliyunStrategy } from './aliyun.strategy';
import { VolcengineStrategy } from './volcengine.strategy';
import { resolveProvider } from '../providers/provider-registry';

/**
 * 策略工厂
 * 根据模型配置获取对应的 Provider 策略
 */
@Injectable()
export class StrategyFactory {
  private readonly logger = new Logger(StrategyFactory.name);
  private readonly strategies: Map<string, IProviderStrategy>;

  /**
   * 构造函数
   * @param openaiStrategy OpenAI 策略
   * @param zhipuStrategy 智谱策略
   * @param deepseekStrategy DeepSeek 策略
   * @param ollamaStrategy Ollama 策略
   * @param aliyunStrategy 阿里云通义策略
   * @param volcengineStrategy 火山引擎策略
   */
  constructor(
    private readonly openaiStrategy: OpenAIStrategy,
    private readonly zhipuStrategy: ZhipuStrategy,
    private readonly deepseekStrategy: DeepSeekStrategy,
    private readonly ollamaStrategy: OllamaStrategy,
    private readonly aliyunStrategy: AliyunStrategy,
    private readonly volcengineStrategy: VolcengineStrategy,
  ) {
    this.strategies = new Map<string, IProviderStrategy>([
      ['openai', this.openaiStrategy],
      ['zhipu', this.zhipuStrategy],
      ['deepseek', this.deepseekStrategy],
      ['ollama', this.ollamaStrategy],
      ['aliyun', this.aliyunStrategy],
      ['volcengine', this.volcengineStrategy],
    ]);
  }

  /**
   * 获取策略
   * @param provider Provider 标识
   * @param modelCode 模型代码（用于自动检测）
   * @returns Provider 策略
   */
  getStrategy(provider: string | null | undefined, modelCode?: string): IProviderStrategy {
    const resolvedProvider = resolveProvider(provider, modelCode || '');
    const strategy = this.strategies.get(resolvedProvider);

    if (!strategy) {
      this.logger.warn(`未找到 ${resolvedProvider} 的策略，使用 OpenAI 策略`);
      return this.openaiStrategy;
    }

    return strategy;
  }
}

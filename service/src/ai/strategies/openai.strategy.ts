import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';

/**
 * OpenAI 策略
 * OpenAI 官方 API 的调用策略
 */
@Injectable()
export class OpenAIStrategy extends BaseStrategy {
  readonly name = 'OpenAI';
  readonly providerId = 'openai';
}

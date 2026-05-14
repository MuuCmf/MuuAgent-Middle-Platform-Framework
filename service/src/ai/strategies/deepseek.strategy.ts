import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';

/**
 * DeepSeek 策略
 * DeepSeek API 的调用策略
 */
@Injectable()
export class DeepSeekStrategy extends BaseStrategy {
  readonly name = 'DeepSeek';
  readonly providerId = 'deepseek';
}

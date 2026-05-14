import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './base.strategy';

/**
 * 智谱 AI 策略
 */
@Injectable()
export class ZhipuStrategy extends BaseStrategy {
  readonly name = '智谱AI';
  readonly providerId = 'zhipu';
}

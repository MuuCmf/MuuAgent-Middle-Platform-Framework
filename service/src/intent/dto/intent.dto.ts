/**
 * 意图分类结果接口
 */
export interface IntentResult {
  /** 意图分类标签 */
  intent: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 分类来源 */
  source: 'keyword' | 'ai' | 'default';
}

/**
 * 意图分类枚举
 */
export enum IntentType {
  /** 通用对话 */
  GENERAL = 'general',
  /** 编程开发 */
  CODE = 'code',
  /** 数学计算 */
  MATH = 'math',
  /** 创意写作 */
  CREATIVE = 'creative',
  /** 专业领域 */
  PROFESSIONAL = 'professional',
  /** 图像生成 */
  IMAGE = 'image',
  /** 语音合成 */
  TTS = 'tts',
  /** 语音识别 */
  ASR = 'asr',
  /** 端到端语音 */
  S2S = 's2s',
}

/**
 * 意图到模型类型的映射
 */
export const INTENT_TO_MODEL_TYPE: Record<string, string> = {
  [IntentType.GENERAL]: 'llm',
  [IntentType.CODE]: 'llm',
  [IntentType.MATH]: 'llm',
  [IntentType.CREATIVE]: 'llm',
  [IntentType.PROFESSIONAL]: 'lmm',
  [IntentType.IMAGE]: 'image',
  [IntentType.TTS]: 'tts',
  [IntentType.ASR]: 'asr',
  [IntentType.S2S]: 's2s',
};
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
  /** 视觉理解（图片分析/识别，区别于 IMAGE 的生成） */
  VISION = 'vision',
}

/**
 * 意图到模型类型的映射（支持优先级列表）
 * 
 * 数组顺序 = 调度优先级：
 *   - 排在越前面的类型越优先被使用
 *   - 前一个类型无可用模型时，自动降级到下一个类型
 * 
 * Omni 类型排在首位，实现"Omni 优先，专用兜底"的策略
 */
export const INTENT_TO_MODEL_TYPE: Record<string, string[]> = {
  [IntentType.GENERAL]: ['omni', 'llm'],
  [IntentType.CODE]: ['omni', 'llm'],
  [IntentType.MATH]: ['omni', 'llm'],
  [IntentType.CREATIVE]: ['omni', 'llm'],
  [IntentType.PROFESSIONAL]: ['omni', 'lmm'],
  [IntentType.IMAGE]: ['omni', 'image'],
  [IntentType.TTS]: ['omni', 'tts'],
  [IntentType.ASR]: ['omni', 'asr'],
  [IntentType.S2S]: ['omni', 's2s'],
  [IntentType.VISION]: ['omni', 'lmm'],
};

/**
 * 意图到能力标识的映射
 * 用于 filterByIntent() 对所有模型进行能力匹配，替代原有的 tags 筛选
 */
export const INTENT_TO_CAPABILITY: Record<string, string[]> = {
  [IntentType.GENERAL]: ['llm:chat'],
  [IntentType.CODE]: ['llm:chat', 'llm:reasoning'],
  [IntentType.MATH]: ['llm:chat', 'llm:reasoning'],
  [IntentType.CREATIVE]: ['llm:chat', 'llm:reasoning'],
  [IntentType.PROFESSIONAL]: ['lmm:vision'],
  [IntentType.IMAGE]: ['image'],
  [IntentType.TTS]: ['tts', 'tts:realtime'],
  [IntentType.ASR]: ['asr'],
  [IntentType.S2S]: ['s2s'],
  [IntentType.VISION]: ['lmm:vision'],
};
/**
 * 能力标识枚举
 * 格式: {baseType}:{subType} 或 {baseType}
 * 
 * 所有模型通过此枚举声明自身能力，替代原有的 tags 字段
 */
export enum Capability {
  /** 文本对话 */
  LLM_CHAT = 'llm:chat',
  /** 推理 */
  LLM_REASONING = 'llm:reasoning',
  /** 图像理解 */
  LMM_VISION = 'lmm:vision',
  /** 图像生成 */
  IMAGE = 'image',
  /** 语音合成（非实时） */
  TTS = 'tts',
  /** 实时流式语音合成 */
  TTS_REALTIME = 'tts:realtime',
  /** 语音识别 */
  ASR = 'asr',
  /** 端到端语音 */
  S2S = 's2s',
  /** 文本向量化 */
  EMBEDDING = 'embedding',
}
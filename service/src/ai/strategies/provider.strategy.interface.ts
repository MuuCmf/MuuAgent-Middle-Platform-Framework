import { Model } from '@prisma/client';
import type { ModelMessage, Tool } from 'ai';
import {
  ExecutionParams,
  ExecutionResult,
  StreamChunk,
  ToolCall,
  ExecutionContext,
  ExecutionOptions,
  TokenUsage,
} from '../interfaces/executor.interface';

/**
 * TTS执行参数接口
 */
export interface TTSExecutionParams {
  model: Model;
  text: string;
  voice?: string;
  speed?: number;
  context: ExecutionContext;

  /**
   * Qwen-TTS Realtime 交互模式（仅阿里云 DashScope WebSocket 流式TTS有效）
   *
   * - 'server_commit': 服务端智能处理文本分段与合成时机，客户端只需持续追加文本
   *                   适合大段文本连续合成、AI对话流式输出等场景
   * - 'commit':       客户端主动提交文本缓冲区以触发合成，适合需要精确控制合成时机的场景
   *
   * 默认值: 'server_commit'
   */
  mode?: 'server_commit' | 'commit';
}

/**
 * TTS执行结果接口
 */
export interface TTSExecutionResult {
  audioUrl?: string;
  audioData?: string;
  format: string;
  duration?: number;
}

/**
 * ASR执行参数接口
 */
export interface ASRExecutionParams {
  model: Model;
  audio: string;
  format?: string;
  context: ExecutionContext;
}

/**
 * ASR执行结果接口
 */
export interface ASRExecutionResult {
  text: string;
  confidence?: number;
  language?: string;
}

/**
 * 流式TTS合成音频块
 */
export interface TTSStreamChunk {
  /** 音频数据（Base64 编码） */
  audioData: string;
  /** 音频格式：pcm / mp3 / wav / opus */
  format: string;
  /** 当前块序号（从0开始） */
  sequence: number;
  /** 是否为最后一块 */
  isLast: boolean;
  /** PCM 采样率（仅 format=pcm 时有效，默认 24000） */
  sampleRate?: number;
}

/**
 * S2S端到端语音执行参数接口
 */
export interface S2SExecutionParams {
  /** 模型配置 */
  model: Model;
  /** 输入音频数据（Base64 编码） */
  audio: string;
  /** 输入音频格式 */
  audioFormat?: string;
  /** 输出音色标识（可选） */
  voice?: string;
  /** 执行上下文 */
  context: ExecutionContext;
}

/**
 * S2S端到端语音执行结果接口
 */
export interface S2SExecutionResult {
  /** 输出音频数据（Base64 编码） */
  audioData: string;
  /** 输出音频格式 */
  format: string;
  /** 中间转写文本（可选） */
  text?: string;
  /** 音频时长（毫秒，可选） */
  duration?: number;
}

/**
 * S2S流式音频块
 */
export interface S2SStreamChunk {
  /** 输出音频数据（Base64 编码） */
  audioData: string;
  /** 音频格式：pcm / mp3 / opus */
  format: string;
  /** 当前块序号（从0开始） */
  sequence: number;
  /** 是否为最后一块 */
  isLast: boolean;
  /** 流式文本中间结果（可选） */
  textDelta?: string;
  /** PCM 采样率（仅 format=pcm 时有效，默认 24000） */
  sampleRate?: number;
}

/**
 * Omni 执行参数接口
 */
export interface OmniExecutionParams {
  /** 模型配置 */
  model: Model;
  /** 消息列表（可能包含多模态内容） */
  messages: ModelMessage[];
  /** 系统提示词 */
  system?: string;
  /** 工具定义 */
  tools?: Record<string, Tool>;
  /** 执行选项 */
  options?: ExecutionOptions;
  /** 执行上下文 */
  context: ExecutionContext;
}

/**
 * Omni 执行结果接口
 */
export interface OmniExecutionResult {
  /** 文本输出 */
  text: string;
  /** 音频输出（Base64，如果模型返回了音频） */
  audioData?: string;
  /** 音频格式 */
  audioFormat?: string;
  /** Token 使用统计 */
  usage?: TokenUsage;
  /** 原始响应 */
  raw?: unknown;
}

/**
 * Provider 策略接口
 * 每个提供商实现自己的策略
 */
export interface IProviderStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 支持的 Provider 标识
   */
  readonly providerId: string;

  /**
   * 创建 SDK provider 实例
   * @param model 模型配置
   * @returns SDK provider 实例
   */
  createProvider(model: Model): ReturnType<typeof import('@ai-sdk/openai').createOpenAI>;

  /**
   * 执行同步调用
   * @param params 执行参数
   * @returns 执行结果
   */
  execute(params: ExecutionParams): Promise<ExecutionResult>;

  /**
   * 执行流式调用
   * @param params 执行参数
   * @returns 流式响应块迭代器
   */
  stream(params: ExecutionParams): AsyncIterable<StreamChunk>;

  /**
   * 解析工具调用（可选）
   * 某些 Provider 可能使用特殊的工具调用格式
   * @param response 原始响应
   * @returns 工具调用或 null
   */
  parseToolCall?(response: unknown): ToolCall | null;

  /**
   * 获取模型名称
   * 某些 Provider 可能需要特殊处理模型名称
   * @param model 模型配置
   * @returns 模型名称
   */
  getModelName?(model: Model): string;

  /**
   * TTS语音合成（可选）
   * @param params TTS参数
   * @returns TTS结果
   */
  executeTTS?(params: TTSExecutionParams): Promise<TTSExecutionResult>;

  /**
   * 流式TTS合成（可选）
   *
   * 支持流式 TTS 输出的提供商实现此方法。
   * TtsService 不关心底层协议细节，只消费 AsyncIterable。
   *
   * @param params TTS执行参数（model / text / voice / speed / context）
   * @returns 音频块异步迭代器
   */
  executeTTSStream?(params: TTSExecutionParams): AsyncIterable<TTSStreamChunk>;

  /**
   * ASR语音识别（可选）
   * @param params ASR参数
   * @returns ASR结果
   */
  executeASR?(params: ASRExecutionParams): Promise<ASRExecutionResult>;

  /**
   * S2S端到端语音（可选）
   * @param params S2S参数
   * @returns S2S结果
   */
  executeS2S?(params: S2SExecutionParams): Promise<S2SExecutionResult>;

  /**
   * 流式S2S端到端语音（可选）
   * @param params S2S执行参数
   * @returns 音频块异步迭代器
   */
  executeS2SStream?(params: S2SExecutionParams): AsyncIterable<S2SStreamChunk>;

  /**
   * 执行 Omni 模型调用（可选实现）
   * 支持多模态输入输出
   * 
   * @param params Omni 执行参数
   * @returns Omni 执行结果
   */
  executeOmni?(params: OmniExecutionParams): Promise<OmniExecutionResult>;

  /**
   * 流式执行 Omni 模型调用（可选实现）
   * 
   * @param params Omni 执行参数
   * @returns 流式响应块迭代器
   */
  streamOmni?(params: OmniExecutionParams): AsyncIterable<StreamChunk>;
}

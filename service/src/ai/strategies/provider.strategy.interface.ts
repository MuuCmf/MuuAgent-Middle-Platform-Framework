import { Model } from '@prisma/client';
import {
  ExecutionParams,
  ExecutionResult,
  StreamChunk,
  ToolCall,
  ExecutionContext,
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
   * 是否支持实时流式TTS合成
   * 实时合成逐块返回音频数据（如PCM块），适合边生成边播放
   * 非实时合成则等待完整音频生成后一次性返回
   */
  readonly supportsRealtimeTTS?: boolean;

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
   * TtsStreamService 不关心底层协议细节，只消费 AsyncIterable。
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
}

import { Injectable, Logger } from '@nestjs/common';
import { StreamChunk, ToolCall } from '../interfaces/executor.interface';

/**
 * 流式处理器配置接口
 */
export interface StreamProcessorConfig {
  /** 函数调用开始标记 */
  functionCallBegin: string;
  /** 函数调用结束标记 */
  functionCallEnd: string;
  /** 缓冲区最大长度 */
  maxBufferSize: number;
}

/**
 * 文本增量处理结果接口
 */
export interface TextDeltaResult {
  /** 安全发送的文本 */
  safeText: string;
  /** 新的缓冲区 */
  newBuffer: string;
}

/**
 * 流式处理器
 * 处理流式响应中的特殊标记和缓冲
 */
@Injectable()
export class StreamProcessor {
  private readonly logger = new Logger(StreamProcessor.name);

  /**
   * 默认配置
   */
  private readonly defaultConfig: StreamProcessorConfig = {
    functionCallBegin: '<|FunctionCallBegin|>',
    functionCallEnd: '<|FunctionCallEnd|>',
    maxBufferSize: 10000,
  };

  /**
   * 处理文本增量
   * 处理特殊标记并返回安全的发送内容
   * @param delta 文本增量
   * @param buffer 缓冲区
   * @param config 配置
   * @returns 处理结果
   */
  processTextDelta(
    delta: string,
    buffer: string,
    config: Partial<StreamProcessorConfig> = {},
  ): TextDeltaResult {
    const cfg = { ...this.defaultConfig, ...config };
    const newBuffer = buffer + delta;

    if (newBuffer.includes(cfg.functionCallBegin)) {
      return this.handleFunctionCallMarker(newBuffer, cfg);
    }

    const safeLength = Math.max(0, newBuffer.length - cfg.functionCallBegin.length);
    if (safeLength > 0) {
      const safeText = newBuffer.substring(0, safeLength);
      return {
        safeText,
        newBuffer: newBuffer.substring(safeLength),
      };
    }

    return { safeText: '', newBuffer };
  }

  /**
   * 处理函数调用标记
   * @param buffer 缓冲区
   * @param config 配置
   * @returns 处理结果
   */
  private handleFunctionCallMarker(
    buffer: string,
    config: StreamProcessorConfig,
  ): TextDeltaResult {
    const beginIdx = buffer.indexOf(config.functionCallBegin);
    const beforeMarker = buffer.substring(0, beginIdx);

    if (buffer.includes(config.functionCallEnd)) {
      const endIdx = buffer.indexOf(config.functionCallEnd) + config.functionCallEnd.length;
      const afterMarker = buffer.substring(endIdx);
      return {
        safeText: beforeMarker,
        newBuffer: afterMarker,
      };
    }

    return {
      safeText: beforeMarker,
      newBuffer: buffer.substring(beginIdx),
    };
  }

  /**
   * 清除函数调用标记
   * @param text 文本
   * @param config 配置
   * @returns 清除后的文本
   */
  stripFunctionCallMarkers(
    text: string,
    config: Partial<StreamProcessorConfig> = {},
  ): string {
    const cfg = { ...this.defaultConfig, ...config };
    const pattern = new RegExp(
      `${this.escapeRegex(cfg.functionCallBegin)}[\\s\\S]*?${this.escapeRegex(cfg.functionCallEnd)}`,
      'g'
    );
    return text.replace(pattern, '').trim();
  }

  /**
   * 检测文本中是否包含函数调用标记
   * @param text 文本
   * @param config 配置
   * @returns 是否包含标记
   */
  containsFunctionCallMarkers(
    text: string,
    config: Partial<StreamProcessorConfig> = {},
  ): boolean {
    const cfg = { ...this.defaultConfig, ...config };
    return text.includes(cfg.functionCallBegin);
  }

  /**
   * 转义正则特殊字符
   * @param str 字符串
   * @returns 转义后的字符串
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 处理剩余缓冲区
   * @param buffer 缓冲区
   * @returns 处理后的文本
   */
  processRemainingBuffer(buffer: string): string {
    if (!buffer) return '';
    return this.stripFunctionCallMarkers(buffer);
  }
}

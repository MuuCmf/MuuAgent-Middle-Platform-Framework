import { httpClient } from '../utils/request';

/**
 * ASR 识别请求参数
 */
export interface AsrRequest {
  /** Base64 编码的音频数据 */
  audio: string;
  /** 音频格式，如 'webm', 'wav', 'mp3' */
  format?: string;
  /** 指定模型编码（可选） */
  modelCode?: string;
}

/**
 * ASR 识别结果
 */
export interface AsrResult {
  /** 识别的文本 */
  text: string;
  /** 置信度 (0-1) */
  confidence?: number;
  /** 识别语言 */
  language?: string;
}

/**
 * ASR 语音识别服务
 *
 * 将浏览器录制的音频数据（Base64）发送到后端 ASR 接口进行识别。
 * 后端根据模型配置自动选择合适的 ASR 引擎（Whisper / DashScope）。
 */
class AsrService {
  /**
   * 发送音频数据到 ASR 接口进行识别
   * 
   * @param audioBase64 Base64 编码的音频数据
   * @param format 音频格式，默认 'webm'
   * @param modelCode 指定模型编码（可选，不传则自动选择）
   * @returns 识别结果
   */
  async recognize(
    audioBase64: string,
    format: string = 'webm',
    modelCode?: string,
  ): Promise<AsrResult> {
    const requestData: AsrRequest = {
      audio: audioBase64,
      format,
    };
    if (modelCode) {
      requestData.modelCode = modelCode;
    }

    const response = await httpClient.getInstance().post<{
      code: number;
      message: string;
      data: AsrResult;
    }>('/ai/asr', requestData);

    if (response.data.code !== 2000) {
      throw new Error(response.data.message || '语音识别失败');
    }

    return response.data.data;
  }

  /**
   * 快速语音识别（简化调用）
   * 自动选择格式和模型
   * 
   * @param audioBase64 Base64 编码的音频数据
   * @param format 音频格式
   * @returns 识别文本
   */
  async recognizeQuick(audioBase64: string, format: string = 'webm'): Promise<string> {
    const result = await this.recognize(audioBase64, format);
    return result.text || '';
  }
}

/** 单例导出 */
export const asrService = new AsrService();
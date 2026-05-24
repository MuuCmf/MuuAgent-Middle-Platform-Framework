import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExecutionParams, ExecutionResult } from '../interfaces/executor.interface';
import { NormalizedError } from '../handlers/error.handler';

/**
 * 日志数据接口
 */
export interface LogData {
  modelId: string;
  modelCode: string;
  modelType: string;
  request: string;
  response: string;
  costMs: number;
  success: boolean;
  clientIp: string;
  userAgent?: string;
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
  uid?: string;
  appCode?: string;
}

/**
 * 日志服务
 * 统一管理所有模型调用日志
 */
@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  /**
   * 构造函数
   * @param prisma Prisma 服务
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录成功调用
   * @param params 执行参数
   * @param result 执行结果
   */
  async logSuccess(params: ExecutionParams, result: ExecutionResult): Promise<void> {
    const { model, context } = params;

    await this.saveLog({
      modelId: model.id as any,
      modelCode: model.code || '',
      modelType: 'llm',
      request: this.serializeRequest(params),
      response: this.serializeResponse(result),
      costMs: Date.now() - context.startTime,
      success: true,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      uid: context.uid,
      appCode: context.appCode,
      inputTokens: result.usage?.promptTokens,
      outputTokens: result.usage?.completionTokens,
    });
  }

  /**
   * 记录失败调用
   * @param params 执行参数
   * @param error 标准化错误
   */
  async logFailure(params: ExecutionParams, error: NormalizedError): Promise<void> {
    const { model, context } = params;

    await this.saveLog({
      modelId: model.id as any,
      modelCode: model.code || '',
      modelType: 'llm',
      request: this.serializeRequest(params),
      response: JSON.stringify({ error: error.message, code: error.code }),
      costMs: Date.now() - context.startTime,
      success: false,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      errorMessage: error.message,
      uid: context.uid,
      appCode: context.appCode,
    });
  }

  /**
   * 记录流式调用结果
   * @param params 执行参数
   * @param fullText 完整文本
   * @param usage Token使用统计
   */
  async logStreamResult(
    params: ExecutionParams,
    fullText: string,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number },
  ): Promise<void> {
    const { model, context } = params;

    await this.saveLog({
      modelId: model.id as any,
      modelCode: model.code || '',
      modelType: 'llm',
      request: this.serializeRequest(params),
      response: JSON.stringify({
        text: fullText.substring(0, 1000),
        usage: usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }),
      costMs: Date.now() - context.startTime,
      success: true,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      uid: context.uid,
      appCode: context.appCode,
      inputTokens: usage?.promptTokens,
      outputTokens: usage?.completionTokens,
    });
  }

  /**
   * 序列化请求
   * 截断大体积数据（如截图 Base64）防止 DB 列溢出
   * @param params 执行参数
   * @returns 序列化后的请求
   */
  private serializeRequest(params: ExecutionParams): string {
    const MAX_MESSAGE_LENGTH = 500
    const truncatedMessages = params.messages.map((msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (content.length <= MAX_MESSAGE_LENGTH) return msg
      return {
        ...msg,
        content: content.substring(0, MAX_MESSAGE_LENGTH) + `...[截断，原${content.length}字符]`,
      }
    })
    return JSON.stringify({
      system: params.system?.substring(0, 1000),
      messages: truncatedMessages,
      tools: params.tools ? Object.keys(params.tools) : [],
      options: params.options,
    })
  }

  /**
   * 序列化响应
   * @param result 执行结果
   * @returns 序列化后的响应
   */
  private serializeResponse(result: ExecutionResult): string {
    return JSON.stringify({
      content: result.content.substring(0, 1000),
      finishReason: result.finishReason,
      usage: result.usage,
      toolCalls: result.toolCalls,
    });
  }

  /**
   * 保存日志
   * @param data 日志数据
   */
  async saveLog(data: LogData): Promise<void> {
    try {
      await this.prisma.aiInvokeLog.create({ data: data as any });
    } catch (error) {
      this.logger.error('保存日志失败:', error);
    }
  }
}

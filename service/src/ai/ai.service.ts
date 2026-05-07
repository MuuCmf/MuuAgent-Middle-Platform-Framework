import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { ModelService } from '../model/model.service';
import {
  AiInvokeDto,
  EmbeddingDto,
  ImageGenerateDto,
  TtsDto,
  AsrDto,
} from './dto/ai.dto';
import axios from 'axios';
import { Observable } from 'rxjs';
import { Model } from '@prisma/client';

/**
 * AI统一调用服务
 * 提供模型调用的统一入口
 */
@Injectable()
export class AiService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param mcpService MCP调度服务
   * @param modelService 模型服务
   */
  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private modelService: ModelService,
  ) {}

  /**
   * 统一AI调用(非流式)
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>>} 调用结果
   */
  async invoke(
    dto: AiInvokeDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const modelType = dto.modelType || 'llm';

    console.log('=== AI调用开始 ===');
    console.log('modelType:', modelType);
    console.log('modelCode:', dto.modelCode);

    // 选择模型
    let model: Model;
    try {
      if (dto.modelCode) {
        console.log('使用指定模型:', dto.modelCode);
        model = await this.modelService.findByCode(dto.modelCode);
      } else {
        console.log('使用MCP调度选择模型');
        model = await this.mcpService.selectModel(modelType);
      }
      console.log('选中的模型:', model);
    } catch (error) {
      console.error('模型选择失败:', error);
      throw error;
    }

    // 检查熔断和并发
    await this.mcpService.checkCircuit(model.id);
    await this.mcpService.checkConcurrency(model.id);

    try {
      // 构建请求
      const requestData = this.buildRequestData(model, dto);

      // 打印请求信息用于调试
      console.log('=== AI调用请求 ===');
      console.log('提供商:', model.provider);
      console.log('模型标识:', model.code);
      console.log('API地址:', model.endpoint);
      console.log('请求数据:', JSON.stringify(requestData, null, 2));

      // 调用模型
      const response = await axios.post(model.endpoint, requestData, {
        headers: this.buildHeaders(model),
        timeout: 30000,
      });

      // 记录成功
      await this.mcpService.reportSuccess(model.id);

      // 提取token信息
      const tokenInfo = this.extractTokenInfo(response.data);

      // 记录日志
      await this.saveLog({
        modelId: model.id,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(response.data),
        costMs: Date.now() - startTime,
        success: true,
        clientIp,
        userAgent,
        inputTokens: tokenInfo.inputTokens,
        outputTokens: tokenInfo.outputTokens,
        uid,
      });

      return response.data;
    } catch (error) {
      // 打印详细错误信息
      console.error('=== AI调用失败 ===');
      if (axios.isAxiosError(error)) {
        console.error('状态码:', error.response?.status);
        console.error('响应数据:', JSON.stringify(error.response?.data, null, 2));
        console.error('请求配置:', JSON.stringify({
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        }, null, 2));
      }

      // 记录错误
      await this.mcpService.reportError(model.id);

      // 构建详细错误消息
      let errorMsg = '未知错误';
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data;
        if (respData?.error?.message) {
          errorMsg = respData.error.message;
        } else if (respData?.message) {
          errorMsg = respData.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }

      // 记录日志
      await this.saveLog({
        modelId: model.id,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : errorMsg,
        costMs: Date.now() - startTime,
        success: false,
        clientIp,
        userAgent,
        errorMessage: errorMsg,
        uid,
      });

      throw new HttpException(
        `模型调用失败: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // 释放并发
      await this.mcpService.releaseConcurrency(model.id);
    }
  }

  /**
   * SSE流式调用
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @returns {Observable<MessageEvent>} 流式响应
   */
  streamInvoke(dto: AiInvokeDto, clientIp: string, userAgent: string, uid?: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      (async () => {
        const startTime = Date.now();
        const modelType = dto.modelType || 'llm';

        let model: Model;
        try {
          // 选择模型
          if (dto.modelCode) {
            model = await this.modelService.findByCode(dto.modelCode);
          } else {
            model = await this.mcpService.selectModel(modelType);
          }

          // 检查熔断和并发
          await this.mcpService.checkCircuit(model.id);
          await this.mcpService.checkConcurrency(model.id);

          // 构建请求
          const requestData = this.buildRequestData(model, dto, true);

          // 调用模型(流式)
          const response = await axios.post(model.endpoint, requestData, {
            headers: this.buildHeaders(model),
            responseType: 'stream',
            timeout: 0,
          });

          const fullResponse: any[] = [];
          let buffer = '';
          let tokenInfo: { inputTokens?: number; outputTokens?: number } = {};
          let finalResponse: Record<string, unknown> | null = null;

          response.data.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            buffer += text;

            // 按双换行符分割SSE事件
            const events = buffer.split('\n\n');
            
            // 保留最后一个不完整的事件
            buffer = events.pop() || '';

            // 处理每个完整的事件
            for (const event of events) {
              if (!event.trim()) continue;

              const lines = event.split('\n');
              for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (!trimmedLine || trimmedLine.startsWith(':')) continue;
                
                if (trimmedLine.startsWith('data:')) {
                  const data = trimmedLine.substring(5).trim();
                  
                  if (data === '[DONE]') {
                    // 发送 [DONE] 信号（带换行符）
                    observer.next(new MessageEvent('message', { data: '[DONE]\n' }));
                    continue;
                  }

                  try {
                    // 验证JSON格式
                    const parsed = JSON.parse(data);
                    
                    // 提取token信息（流式响应中usage通常在最后一个chunk）
                    if (parsed.usage) {
                      tokenInfo = this.extractTokenInfo(parsed);
                    }

                    // 收集响应片段用于日志
                    fullResponse.push(parsed);
                    
                    // 发送JSON数据（带换行符）
                    const jsonData = JSON.stringify(parsed);
                    observer.next(new MessageEvent('message', { data: jsonData + '\n' }));
                  } catch (e) {
                    // JSON解析失败，跳过
                    console.warn('流式数据JSON解析失败:', data.substring(0, 100));
                  }
                }
              }
            }
          });

          response.data.on('end', async () => {
            // 记录成功
            await this.mcpService.reportSuccess(model.id);

            // 合并流式响应为一个完整的响应对象
            if (fullResponse.length > 0) {
              // 尝试合并所有片段为一个完整响应
              finalResponse = this.mergeStreamResponses(fullResponse);
            }

            // 记录日志
            await this.saveLog({
              modelId: model.id,
              modelCode: model.code,
              modelType,
              request: JSON.stringify(dto),
              response: finalResponse ? JSON.stringify(finalResponse) : JSON.stringify(fullResponse),
              costMs: Date.now() - startTime,
              success: true,
              clientIp,
              userAgent,
              inputTokens: tokenInfo.inputTokens,
              outputTokens: tokenInfo.outputTokens,
              uid,
            });

            // 释放并发
            await this.mcpService.releaseConcurrency(model.id);

            observer.next(new MessageEvent('message', { data: '[DONE]' }));
            observer.complete();
          });

          response.data.on('error', async (err: Error) => {
            await this.mcpService.reportError(model.id);
            await this.mcpService.releaseConcurrency(model.id);

            observer.next(
              new MessageEvent('message', { data: `[ERROR] ${err.message}` }),
            );
            observer.complete();
          });
        } catch (error) {
          observer.next(
            new MessageEvent('message', {
              data: `[ERROR] ${error instanceof Error ? error.message : '未知错误'}`,
            }),
          );
          observer.complete();
        }
      })();
    });
  }

  /**
   * Embedding向量生成
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>>} 向量结果
   */
  async embedding(
    dto: EmbeddingDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const modelType = dto.modelType || 'embedding';

    let model: Model;
    if (dto.modelCode) {
      model = await this.modelService.findByCode(dto.modelCode);
    } else {
      model = await this.mcpService.selectModel(modelType);
    }

    await this.mcpService.checkCircuit(model.id);

    try {
      // 构建请求数据（不同提供商格式可能不同）
      const requestData = this.buildEmbeddingRequestData(model, dto);

      console.log('[Embedding] 请求数据:', JSON.stringify(requestData, null, 2));
      console.log('[Embedding] 模型信息:', { provider: model.provider, endpoint: model.endpoint });

      const response = await axios.post(
        model.endpoint,
        requestData,
        {
          headers: this.buildHeaders(model),
          timeout: 30000,
        },
      );

      await this.mcpService.reportSuccess(model.id);

      console.log('[Embedding] 响应数据:', JSON.stringify(response.data, null, 2));

      // 提取token信息
      const tokenInfo = this.extractTokenInfo(response.data);

      await this.saveLog({
        modelId: model.id,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(response.data),
        costMs: Date.now() - startTime,
        success: true,
        clientIp,
        userAgent,
        inputTokens: tokenInfo.inputTokens,
        outputTokens: tokenInfo.outputTokens,
        uid,
      });

      return response.data;
    } catch (error) {
      await this.mcpService.reportError(model.id);

      // 打印详细错误信息
      console.error('[Embedding] 调用失败:');
      if (axios.isAxiosError(error)) {
        console.error('状态码:', error.response?.status);
        console.error('响应数据:', JSON.stringify(error.response?.data, null, 2));
      }

      throw new HttpException(
        `Embedding生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 构建Embedding请求数据
   * @param model 模型信息
   * @param dto 调用参数
   * @returns {Record<string, unknown>} 请求数据
   */
  private buildEmbeddingRequestData(model: Model, dto: EmbeddingDto): Record<string, unknown> {
    const provider = model.provider?.toLowerCase();

    // 智谱AI格式
    if (provider === 'zhipu') {
      return {
        model: model.code,
        input: dto.input,
      };
    }

    // OpenAI兼容格式（默认）
    return {
      model: model.code,
      input: dto.input,
    };
  }

  /**
   * 文生图
   * @param dto 调用参数
   * @param clientIp 客户端IP
   * @param userAgent 用户代理
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>>} 图片结果
   */
  async imageGenerate(
    dto: ImageGenerateDto,
    clientIp: string,
    userAgent: string,
    uid?: string,
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const modelType = dto.modelType || 'image';

    let model: Model;
    if (dto.modelCode) {
      model = await this.modelService.findByCode(dto.modelCode);
    } else {
      model = await this.mcpService.selectModel(modelType);
    }

    await this.mcpService.checkCircuit(model.id);

    try {
      const response = await axios.post(
        model.endpoint,
        {
          prompt: dto.prompt,
          width: dto.width,
          height: dto.height,
          n: dto.n || 1,
        },
        {
          headers: this.buildHeaders(model),
          timeout: 60000,
        },
      );

      await this.mcpService.reportSuccess(model.id);

      // 提取token信息
      const tokenInfo = this.extractTokenInfo(response.data);

      await this.saveLog({
        modelId: model.id,
        modelCode: model.code,
        modelType,
        request: JSON.stringify(dto),
        response: JSON.stringify(response.data),
        costMs: Date.now() - startTime,
        success: true,
        clientIp,
        userAgent,
        inputTokens: tokenInfo.inputTokens,
        outputTokens: tokenInfo.outputTokens,
        uid,
      });

      return response.data;
    } catch (error) {
      await this.mcpService.reportError(model.id);

      throw new HttpException(
        `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 构建请求数据
   * @param model 模型信息
   * @param dto 调用参数
   * @param stream 是否流式
   * @returns {Record<string, unknown>} 请求数据
   */
  private buildRequestData(
    model: Model,
    dto: AiInvokeDto,
    stream = false,
  ): Record<string, unknown> {
    const provider = model.provider.toLowerCase();
    const temperature = dto.temperature ?? model.temperature ?? 0.7;
    const maxTokens = dto.maxTokens ?? model.maxTokens ?? 4096;

    // Ollama 格式
    if (provider === 'ollama') {
      const data: Record<string, unknown> = {
        model: model.code,
        messages: dto.messages,
        stream,
      };
      if (!stream) {
        data['options'] = {
          temperature,
          num_predict: maxTokens,
        };
      }
      if (dto.extra) {
        Object.assign(data, dto.extra);
      }
      return data;
    }

    // 智谱AI 格式 (glm-4, glm-4-flash等)
    if (provider === 'zhipu') {
      const data: Record<string, unknown> = {
        model: model.code,
        messages: dto.messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      };
      if (dto.extra) {
        Object.assign(data, dto.extra);
      }
      return data;
    }

    // DeepSeek 格式
    if (provider === 'deepseek') {
      const data: Record<string, unknown> = {
        model: model.code,
        messages: dto.messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      };
      if (dto.extra) {
        Object.assign(data, dto.extra);
      }
      return data;
    }

    // OpenAI 兼容格式 (OpenAI, Azure, 阿里云, 腾讯, 百度等)
    const data: Record<string, unknown> = {
      model: model.code,
      messages: dto.messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    // 流式请求时添加 stream_options 以获取 token 使用信息
    if (stream) {
      data['stream_options'] = { include_usage: true };
    }

    if (dto.extra) {
      Object.assign(data, dto.extra);
    }

    return data;
  }

  /**
   * 构建请求头
   * @param model 模型信息
   * @returns {Record<string, string>} 请求头
   */
  private buildHeaders(model: Model): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (model.apiKey) {
      headers['Authorization'] = `Bearer ${model.apiKey}`;
    }

    return headers;
  }

  /**
   * 从响应中提取token使用信息
   * @param responseData 响应数据
   * @returns {inputTokens, outputTokens} token信息
   */
  private extractTokenInfo(responseData: any): { inputTokens?: number; outputTokens?: number } {
    if (!responseData) return {};

    if (responseData.usage?.prompt_tokens !== undefined) {
      return {
        inputTokens: responseData.usage.prompt_tokens,
        outputTokens: responseData.usage.completion_tokens,
      };
    }

    if (responseData.usage?.input_tokens !== undefined) {
      return {
        inputTokens: responseData.usage.input_tokens,
        outputTokens: responseData.usage.output_tokens,
      };
    }

    return {};
  }

  /**
   * 合并流式响应片段为完整响应
   * @param responses 响应片段数组
   * @returns {Record<string, unknown>} 合并后的完整响应
   */
  private mergeStreamResponses(responses: any[]): Record<string, unknown> {
    if (!responses || responses.length === 0) {
      return {};
    }

    // 获取最后一个响应作为基础
    const lastResponse = responses[responses.length - 1];
    const merged: Record<string, unknown> = { ...lastResponse };

    // 合并所有choices的delta内容
    if (lastResponse.choices && Array.isArray(lastResponse.choices)) {
      const mergedChoices = lastResponse.choices.map((choice: any, index: number) => {
        const mergedChoice = { ...choice };
        
        // 合并所有delta内容
        if (choice.delta && choice.delta.content !== undefined) {
          let fullContent = '';
          responses.forEach((resp) => {
            if (resp.choices && resp.choices[index] && resp.choices[index].delta) {
              fullContent += resp.choices[index].delta.content || '';
            }
          });
          mergedChoice.delta = { ...choice.delta, content: fullContent };
          mergedChoice.message = { ...choice.message, content: fullContent };
        }

        return mergedChoice;
      });
      merged.choices = mergedChoices;
    }

    // 如果最后一个响应没有usage，但前面的响应有，合并进来
    if (!merged.usage) {
      for (const resp of responses) {
        if (resp.usage) {
          merged.usage = resp.usage;
          break;
        }
      }
    }

    return merged;
  }

  /**
   * 保存调用日志
   * @param data 日志数据
   * @returns {Promise<void>}
   */
  private async saveLog(data: {
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
  }): Promise<void> {
    try {
      await this.prisma.aiInvokeLog.create({
        data: {
          modelId: data.modelId,
          modelCode: data.modelCode,
          modelType: data.modelType,
          request: data.request,
          response: data.response,
          costMs: data.costMs,
          success: data.success,
          clientIp: data.clientIp,
          userAgent: data.userAgent,
          errorMessage: data.errorMessage,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          uid: data.uid,
        },
      });
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }
}

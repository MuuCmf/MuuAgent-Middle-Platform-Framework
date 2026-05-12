import { Injectable, Logger } from '@nestjs/common';
import { Model } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { McpService } from '../../mcp/mcp.service';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, type ModelMessage, type Tool } from 'ai';
import { resolveProvider, resolveBaseUrl, getProviderConfig } from './provider-registry';

/**
 * AI SDK 模型提供者
 * 将现有的 Model 配置适配到 Vercel AI SDK v3
 */
@Injectable()
export class AiSdkProvider {
  private readonly logger = new Logger(AiSdkProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mcpService: McpService,
  ) {}

  /**
   * 创建 AI SDK provider 实例
   * @param model 模型配置
   * @returns AI SDK provider
   */
  createProvider(model: Model): ReturnType<typeof createOpenAI> {
    const provider = resolveProvider(model.provider, model.code || '');
    const apiKey = model.apiKey;
    const config = getProviderConfig(provider);
    const baseURL = resolveBaseUrl(model);

    this.logger.debug(`创建 provider: provider=${provider}, baseURL=${baseURL}, hasApiKey=${!!apiKey}, modelCode=${model.code}`);

    return createOpenAI({
      apiKey: apiKey || (config.requireApiKey ? process.env.OPENAI_API_KEY : 'empty') || undefined,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  /**
   * 获取模型名称（直接使用 model.code，AI SDK 会用此名称调用 API）
   */
  getModelName(model: Model): string {
    return model.code || 'gpt-4';
  }

  /**
   * 执行 generateText（同步调用）
   */
  async generateText(params: {
    model: Model;
    system?: string;
    messages: ModelMessage[];
    tools?: Record<string, Tool>;
    toolChoice?: any;
    temperature?: number;
    maxTokens?: number;
    onStepFinish?: (step: any) => void;
    clientIp?: string;
    userAgent?: string;
    uid?: string;
    appCode?: string;
  }): Promise<{
    text: string;
    finishReason: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    steps?: any[];
    toolCalls?: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }>;
  }> {
    const startTime = Date.now();
    const provider = this.createProvider(params.model);
    const modelName = this.getModelName(params.model);

    this.logger.debug(`generateText: modelName=${modelName}, temperature=${params.temperature}, toolsCount=${params.tools ? Object.keys(params.tools).length : 0}`);

    const tools = params.tools && Object.keys(params.tools).length > 0 ? params.tools : undefined;

    try {
      const result = await generateText({
        model: provider.chat(modelName),
        system: params.system,
        messages: params.messages,
        tools,
        toolChoice: params.toolChoice,
        temperature: params.temperature ?? params.model.temperature ?? 0.7,
        onStepFinish: params.onStepFinish,
      });

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;

      await this.mcpService.reportSuccess(params.model.id);

      await this.saveLog({
        modelId: params.model.id,
        modelCode: params.model.code,
        modelType: 'llm',
        request: JSON.stringify({ messages: params.messages, system: params.system }),
        response: result.text,
        costMs: Date.now() - startTime,
        success: true,
        clientIp: params.clientIp || 'unknown',
        userAgent: params.userAgent,
        inputTokens,
        outputTokens,
        uid: params.uid,
        appCode: params.appCode,
      });

      return {
        text: result.text,
        finishReason: result.finishReason || 'stop',
        usage: result.usage
          ? {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            }
          : undefined,
        steps: result.steps,
        toolCalls: result.toolCalls?.map(tc => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: (tc as any).args,
        })),
      };
    } catch (error) {
      await this.mcpService.reportError(params.model.id);

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.saveLog({
        modelId: params.model.id,
        modelCode: params.model.code,
        modelType: 'llm',
        request: JSON.stringify({ messages: params.messages, system: params.system }),
        response: errorMsg,
        costMs: Date.now() - startTime,
        success: false,
        clientIp: params.clientIp || 'unknown',
        userAgent: params.userAgent,
        errorMessage: errorMsg,
        uid: params.uid,
        appCode: params.appCode,
      });

      throw error;
    }
  }

  /**
   * 执行 streamText（流式调用）
   */
  async streamText(params: {
    model: Model;
    system?: string;
    messages: ModelMessage[];
    tools?: Record<string, Tool>;
    toolChoice?: any;
    temperature?: number;
    maxTokens?: number;
    onChunk?: (chunk: string) => void;
    onToolCall?: (toolCall: { name: string; args: any }) => void;
    onFinish?: (result: any) => void;
    onError?: (error: any) => void;
    clientIp?: string;
    userAgent?: string;
    uid?: string;
    appCode?: string;
  }): Promise<void> {
    const startTime = Date.now();
    const provider = this.createProvider(params.model);
    const modelName = this.getModelName(params.model);

    this.logger.debug(`streamText: modelName=${modelName}, temperature=${params.temperature}, toolsCount=${params.tools ? Object.keys(params.tools).length : 0}`);

    const tools = params.tools && Object.keys(params.tools).length > 0 ? params.tools : undefined;

    try {
      this.logger.debug('开始调用 streamText...');

      const streamResult = streamText({
        model: provider.chat(modelName),
        system: params.system,
        messages: params.messages,
        tools,
        toolChoice: params.toolChoice,
        temperature: params.temperature ?? params.model.temperature ?? 0.7,
      });

      this.logger.debug('streamText 调用完成，开始迭代 fullStream...');

      let fullText = '';
      let finishReason: string | undefined;
      let usage: any;
      let toolCalls: any[] = [];

      for await (const part of streamResult.fullStream) {
        this.logger.debug(`stream part: type=${part.type}`);
        if (part.type === 'text-delta' && params.onChunk) {
          fullText += part.text;
          this.logger.debug(`text-delta: "${part.text}"`);
          params.onChunk(part.text);
        } else if (part.type === 'tool-call') {
          toolCalls.push(part);
          this.logger.debug(`tool call detected: ${JSON.stringify(part)}`);
          this.logger.debug(`tool call keys: ${Object.keys(part).join(', ')}`);
          this.logger.debug(`tool call has name property: ${'name' in part}, has args property: ${'args' in part}`);
        } else if (part.type === 'finish') {
          finishReason = part.finishReason;
          usage = part.totalUsage;
          this.logger.debug(`stream finish: finishReason=${finishReason}`);
        }
      }

      this.logger.debug(`stream 完成: fullText.length=${fullText.length}, toolCalls.length=${toolCalls.length}`);

      await this.mcpService.reportSuccess(params.model.id);

      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;

      await this.saveLog({
        modelId: params.model.id,
        modelCode: params.model.code,
        modelType: 'llm',
        request: JSON.stringify({ messages: params.messages, system: params.system }),
        response: fullText,
        costMs: Date.now() - startTime,
        success: true,
        clientIp: params.clientIp || 'unknown',
        userAgent: params.userAgent,
        inputTokens,
        outputTokens,
        uid: params.uid,
        appCode: params.appCode,
      });

      if (finishReason === 'tool-calls' && toolCalls.length > 0 && params.onToolCall) {
        for (const toolCall of toolCalls) {
          if (toolCall.toolName && params.onToolCall) {
            await params.onToolCall({
              name: toolCall.toolName,
              args: toolCall.input || {},
            });
          }
        }
      } else if (finishReason === 'stop' && params.onToolCall) {
        const textToolCall = this.parseTextAction(fullText);
        if (textToolCall) {
          this.logger.debug(`检测到文本格式工具调用: ${textToolCall.name}`);
          await params.onToolCall(textToolCall);
        }
      }

      if (params.onFinish) {
        params.onFinish({
          text: fullText,
          finishReason,
          usage,
          toolCalls,
        });
      }
    } catch (error) {
      this.logger.error(`streamText error: ${error?.message || error}`);
      this.logger.error(`streamText error stack: ${error?.stack || 'no stack'}`);

      await this.mcpService.reportError(params.model.id);

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.saveLog({
        modelId: params.model.id,
        modelCode: params.model.code,
        modelType: 'llm',
        request: JSON.stringify({ messages: params.messages, system: params.system }),
        response: errorMsg,
        costMs: Date.now() - startTime,
        success: false,
        clientIp: params.clientIp || 'unknown',
        userAgent: params.userAgent,
        errorMessage: errorMsg,
        uid: params.uid,
        appCode: params.appCode,
      });

      if (params.onError) {
        params.onError(error);
      }
    }
  }

  /**
   * 解析文本格式的 Action/Action Input
   * 用于支持不支持 Function Calling 的模型
   * @param text 模型输出的文本
   * @returns 工具调用信息或 null
   */
  private parseTextAction(text: string): { name: string; args: any } | null {
    const actionMatch = text.match(/Action:\s*([^\n]+)/i);
    const actionInputMatch = text.match(/Action\s*Input:\s*(\{[\s\S]*?\}|\[.*?\]|"[^"]*"|[^,\n]+)/i);

    if (actionMatch) {
      const name = actionMatch[1].trim();
      let args = {};

      if (actionInputMatch) {
        const argsStr = actionInputMatch[1].trim();
        try {
          if (argsStr.startsWith('{') || argsStr.startsWith('[')) {
            args = JSON.parse(argsStr);
          } else if (argsStr.startsWith('"') && argsStr.endsWith('"')) {
            args = { input: argsStr.slice(1, -1) };
          } else {
            args = { input: argsStr };
          }
        } catch (e) {
          this.logger.debug(`解析 Action Input 失败: ${argsStr}`);
          args = { raw: argsStr };
        }
      }

      return { name, args };
    }

    return null;
  }

  /**
   * 保存模型调用日志
   * @param data 日志数据
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
    appCode?: string;
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
          appCode: data.appCode,
        },
      });
    } catch (error) {
      this.logger.error('保存日志失败:', error);
    }
  }
}
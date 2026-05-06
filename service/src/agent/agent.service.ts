import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { SkillService } from '../skill/skill.service';
import { ModelService } from '../model/model.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import axios from 'axios';
import { Observable, Observer } from 'rxjs';

/**
 * 智能体服务
 * 提供智能体的CRUD和对话执行功能
 */
@Injectable()
export class AgentService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param mcpService MCP调度服务
   * @param skillService 技能服务
   * @param modelService 模型服务
   */
  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private skillService: SkillService,
    private modelService: ModelService,
  ) {}

  /**
   * 创建智能体
   * @param dto 创建智能体DTO
   * @returns {Promise<Object>} 创建的智能体
   */
  async create(dto: CreateAgentDto) {
    return this.prisma.agent.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        modelId: dto.modelId,
        skills: dto.skills || '[]',
        maxSteps: dto.maxSteps ?? 5,
        temperature: dto.temperature ?? 0.7,
        status: dto.status ?? true,
      },
    });
  }

  /**
   * 更新智能体
   * @param id 智能体ID
   * @param dto 更新智能体DTO
   * @returns {Promise<Object>} 更新后的智能体
   */
  async update(id: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    return this.prisma.agent.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除智能体
   * @param id 智能体ID
   * @returns {Promise<void>}
   */
  async remove(id: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    await this.prisma.agent.delete({ where: { id } });
  }

  /**
   * 根据ID查询智能体
   * @param id 智能体ID
   * @returns {Promise<Object>} 智能体详情
   */
  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  /**
   * 根据Code查询智能体
   * @param code 智能体标识
   * @returns {Promise<Object>} 智能体详情
   */
  async findByCode(code: string) {
    const agent = await this.prisma.agent.findUnique({ where: { code } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  /**
   * 分页查询智能体列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页智能体列表
   */
  async findAll(query: QueryAgentDto) {
    const { status, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status !== undefined) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * Agent对话
   * @param dto 对话请求DTO
   * @param clientIp 客户端IP
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>> | Observable<MessageEvent>} 对话结果
   */
  chat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> | Observable<MessageEvent> {
    if (dto.stream) {
      return this.streamChat(dto, clientIp, uid);
    }
    return this.syncChat(dto, clientIp, uid);
  }

  /**
   * 同步Agent对话
   * @param dto 对话请求DTO
   * @param clientIp 客户端IP
   * @param uid 用户唯一标识(透传)
   * @returns {Promise<Record<string, unknown>>} 对话结果
   */
  async syncChat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    // 获取智能体
    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: {
          OR: [{ id: dto.agentId }, { code: dto.agentId }],
        },
      });
    } catch {
      agent = await this.findByCode(dto.agentId);
    }

    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    if (!agent.status) {
      throw new HttpException('智能体已禁用', HttpStatus.FORBIDDEN);
    }

    // 获取绑定的技能
    const skillCodes: string[] = JSON.parse(agent.skills || '[]');
    const skillDescriptions = skillCodes.length > 0
      ? await this.skillService.getSkillDescriptions(skillCodes)
      : '';

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(agent, skillDescriptions);

    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    let currentMessage = dto.message;
    let finalResponse = '';
    let success = true;
    let errorMessage: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for (let step = 0; step < agent.maxSteps; step++) {
        // 调用LLM
        const llmResult = await this.callLLM(model, systemPrompt, currentMessage, agent.temperature, false);

        // 累加token用量
        if (llmResult.inputTokens) inputTokens += llmResult.inputTokens;
        if (llmResult.outputTokens) outputTokens += llmResult.outputTokens;

        // 解析是否需要调用工具
        const toolCall = this.parseToolCall(llmResult.response);

        if (!toolCall) {
          // 不需要调用工具，直接返回
          finalResponse = llmResult.response;
          break;
        }

        if (toolCall.skill === 'none') {
          finalResponse = llmResult.response;
          break;
        }

        // 执行技能
        steps.push({
          step: step + 1,
          action: `调用技能: ${toolCall.skill}`,
          result: null,
        });

        try {
          const skillResult = await this.skillService.execute({
            skillCode: toolCall.skill as string,
            params: (toolCall.params as Record<string, unknown>) || {},
          });

          steps[steps.length - 1].result = skillResult;

          // 将技能结果返回给LLM继续处理
          currentMessage = `工具执行结果: ${JSON.stringify(skillResult)}\n请根据结果回答用户的问题。`;
        } catch (error) {
          steps[steps.length - 1].result = {
            error: error instanceof Error ? error.message : '执行失败',
          };
          currentMessage = `工具执行失败: ${steps[steps.length - 1].result}\n请尝试其他方式回答用户的问题。`;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法完成您的请求。';
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      finalResponse = `执行出错: ${errorMessage}`;
    }

    // 记录日志
    await this.prisma.agentInvokeLog.create({
      data: {
        agentId: agent.id,
        conversationId: dto.conversationId,
        userMessage: dto.message,
        agentResponse: finalResponse,
        steps: JSON.stringify(steps),
        totalCostMs: Date.now() - startTime,
        success,
        errorMessage,
        clientIp,
        uid,
        inputTokens: inputTokens > 0 ? inputTokens : undefined,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
      },
    });

    return {
      response: finalResponse,
      steps,
      conversationId: dto.conversationId,
    };
  }

  /**
   * 流式Agent对话（使用Response对象）
   * @param dto 对话请求DTO
   * @param clientIp 客户端IP
   * @param uid 用户唯一标识(透传)
   * @param res Express响应对象
   */
  async streamChatToResponse(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    res: any,
  ): Promise<void> {
    const startTime = Date.now();

    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: {
          OR: [{ id: dto.agentId }, { code: dto.agentId }],
        },
      });
    } catch {
      agent = await this.findByCode(dto.agentId);
    }

    if (!agent) {
      res.write(JSON.stringify({ type: 'error', content: '智能体不存在' }) + '\n');
      res.end();
      return;
    }

    if (!agent.status) {
      res.write(JSON.stringify({ type: 'error', content: '智能体已禁用' }) + '\n');
      res.end();
      return;
    }

    // 获取绑定的技能
    const skillCodes: string[] = JSON.parse(agent.skills || '[]');
    const skillDescriptions = skillCodes.length > 0
      ? await this.skillService.getSkillDescriptions(skillCodes)
      : '';

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(agent, skillDescriptions);

    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    let currentMessage = dto.message;
    let finalResponse = '';
    let success = true;
    let errorMessage: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    const sendChunk = (data: any) => {
      res.write(JSON.stringify(data) + '\n');
    };

    try {
      for (let step = 0; step < agent.maxSteps; step++) {
        // 调用LLM（流式）
        let llmResponse = '';
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(model, systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            sendChunk({ type: 'chunk', content: chunk });
          }, resolve);
        });

        // 累加token用量
        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        // 解析是否需要调用工具
        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不需要调用工具，直接返回
          finalResponse = llmResponse;
          break;
        }

        if (toolCall.skill === 'none') {
          finalResponse = llmResponse;
          break;
        }

        // 执行技能
        steps.push({
          step: step + 1,
          action: `调用技能: ${toolCall.skill}`,
          result: null,
        });

        try {
          const skillResult = await this.skillService.execute({
            skillCode: toolCall.skill as string,
            params: (toolCall.params as Record<string, unknown>) || {},
          });

          steps[steps.length - 1].result = skillResult;

          // 发送技能执行结果通知
          sendChunk({ type: 'tool', skill: toolCall.skill, result: skillResult });

          // 将技能结果返回给LLM继续处理
          currentMessage = `工具执行结果: ${JSON.stringify(skillResult)}\n请根据结果回答用户的问题。`;
        } catch (error) {
          steps[steps.length - 1].result = {
            error: error instanceof Error ? error.message : '执行失败',
          };
          currentMessage = `工具执行失败: ${steps[steps.length - 1].result}\n请尝试其他方式回答用户的问题。`;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法完成您的请求。';
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      finalResponse = `执行出错: ${errorMessage}`;
      sendChunk({ type: 'error', content: finalResponse });
    }

    // 记录日志
    await this.prisma.agentInvokeLog.create({
      data: {
        agentId: agent.id,
        conversationId: dto.conversationId,
        userMessage: dto.message,
        agentResponse: finalResponse,
        steps: JSON.stringify(steps),
        totalCostMs: Date.now() - startTime,
        success,
        errorMessage,
        clientIp,
        uid,
        inputTokens: inputTokens > 0 ? inputTokens : undefined,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
      },
    });

    // 发送结束信号
    sendChunk({ type: 'done', content: finalResponse, steps });
    res.end();
  }

  /**
   * 流式Agent对话（Observable版本，保留兼容）
   * @param dto 对话请求DTO
   * @param clientIp 客户端IP
   * @param uid 用户唯一标识(透传)
   * @returns {Observable<MessageEvent>} 流式响应
   */
  streamChat(dto: AgentChatDto, clientIp: string, uid?: string): Observable<MessageEvent> {
    return new Observable((observer: Observer<MessageEvent>) => {
      this.executeStreamChat(dto, clientIp, uid, observer).catch((error) => {
        observer.error(error);
      });
    });
  }

  /**
   * 执行流式对话（Observable版本）
   */
  private async executeStreamChat(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    observer: Observer<MessageEvent>,
  ): Promise<void> {
    const startTime = Date.now();

    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: {
          OR: [{ id: dto.agentId }, { code: dto.agentId }],
        },
      });
    } catch {
      agent = await this.findByCode(dto.agentId);
    }

    if (!agent) {
      observer.error(new NotFoundException('智能体不存在'));
      return;
    }

    if (!agent.status) {
      observer.error(new HttpException('智能体已禁用', HttpStatus.FORBIDDEN));
      return;
    }

    // 获取绑定的技能
    const skillCodes: string[] = JSON.parse(agent.skills || '[]');
    const skillDescriptions = skillCodes.length > 0
      ? await this.skillService.getSkillDescriptions(skillCodes)
      : '';

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(agent, skillDescriptions);

    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    let currentMessage = dto.message;
    let finalResponse = '';
    let success = true;
    let errorMessage: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for (let step = 0; step < agent.maxSteps; step++) {
        // 调用LLM（流式）
        let llmResponse = '';
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(model, systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            observer.next(new MessageEvent('message', { data: JSON.stringify({ type: 'chunk', content: chunk }) + '\n' }));
          }, resolve);
        });

        // 累加token用量
        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        // 解析是否需要调用工具
        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不需要调用工具，直接返回
          finalResponse = llmResponse;
          break;
        }

        if (toolCall.skill === 'none') {
          finalResponse = llmResponse;
          break;
        }

        // 执行技能
        steps.push({
          step: step + 1,
          action: `调用技能: ${toolCall.skill}`,
          result: null,
        });

        try {
          const skillResult = await this.skillService.execute({
            skillCode: toolCall.skill as string,
            params: (toolCall.params as Record<string, unknown>) || {},
          });

          steps[steps.length - 1].result = skillResult;

          // 发送技能执行结果通知
          observer.next(new MessageEvent('message', { 
            data: JSON.stringify({ 
              type: 'tool', 
              skill: toolCall.skill, 
              result: skillResult 
            }) + '\n' 
          }));

          // 将技能结果返回给LLM继续处理
          currentMessage = `工具执行结果: ${JSON.stringify(skillResult)}\n请根据结果回答用户的问题。`;
        } catch (error) {
          steps[steps.length - 1].result = {
            error: error instanceof Error ? error.message : '执行失败',
          };
          currentMessage = `工具执行失败: ${steps[steps.length - 1].result}\n请尝试其他方式回答用户的问题。`;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法完成您的请求。';
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '执行失败';
      finalResponse = `执行出错: ${errorMessage}`;
      observer.next(new MessageEvent('message', { data: JSON.stringify({ type: 'error', content: finalResponse }) + '\n' }));
    }

    // 记录日志
    await this.prisma.agentInvokeLog.create({
      data: {
        agentId: agent.id,
        conversationId: dto.conversationId,
        userMessage: dto.message,
        agentResponse: finalResponse,
        steps: JSON.stringify(steps),
        totalCostMs: Date.now() - startTime,
        success,
        errorMessage,
        clientIp,
        uid,
        inputTokens: inputTokens > 0 ? inputTokens : undefined,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
      },
    });

    // 发送结束信号
    observer.next(new MessageEvent('message', { 
      data: JSON.stringify({ type: 'done', content: finalResponse, steps }) + '\n' 
    }));
    observer.complete();
  }

  /**
   * 构建系统提示词
   * @param agent 智能体信息
   * @param skillDescriptions 技能描述
   * @returns {string} 完整的系统提示词
   */
  private buildSystemPrompt(agent: { systemPrompt: string }, skillDescriptions: string): string {
    let prompt = agent.systemPrompt;

    if (skillDescriptions) {
      prompt += `\n\n你可以使用以下工具:\n${skillDescriptions}`;
      prompt += `\n\n如果需要使用工具，请严格按以下JSON格式输出，不要输出其他内容:
{"skill":"工具标识","params":{"参数名":"参数值"}}

如果不需要使用工具，请输出:
{"skill":"none"}`;
    }

    return prompt;
  }

  /**
   * 调用LLM
   * @param model 模型信息
   * @param systemPrompt 系统提示词
   * @param userMessage 用户消息
   * @param temperature 温度参数
   * @param stream 是否流式输出
   * @returns {Promise<{ response: string; inputTokens?: number; outputTokens?: number }>} LLM响应和token信息
   */
  private async callLLM(
    model: Record<string, unknown>,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    stream: boolean = false,
  ): Promise<{ response: string; inputTokens?: number; outputTokens?: number }> {
    try {
      const response = await axios.post(
        model.endpoint as string,
        {
          model: model.code,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature,
          stream,
        },
        {
          headers: model.apiKey
            ? { Authorization: `Bearer ${model.apiKey}` }
            : {},
          timeout: 60000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content || '';
      const usage = response.data.usage;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      if (usage) {
        inputTokens = usage.prompt_tokens ?? usage.input_tokens;
        outputTokens = usage.completion_tokens ?? usage.output_tokens;
      }

      return { response: content, inputTokens, outputTokens };
    } catch (error) {
      throw new Error(`LLM调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 流式调用LLM
   * @param model 模型信息
   * @param systemPrompt 系统提示词
   * @param userMessage 用户消息
   * @param temperature 温度参数
   * @param onChunk 回调函数，处理每个数据块
   * @param onComplete 回调函数，处理完成
   */
  private async callLLMStream(
    model: Record<string, unknown>,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    onChunk: (chunk: string) => void,
    onComplete: (tokenInfo: { inputTokens?: number; outputTokens?: number }) => void,
  ): Promise<void> {
    const axios = require('axios').default;

    const data = {
      model: model.code,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      stream: true,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (model.apiKey) {
      headers.Authorization = `Bearer ${model.apiKey}`;
    }

    const endpoint = model.endpoint as string;

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    try {
      const response = await axios.post(endpoint, data, {
        headers,
        responseType: 'stream',
      });

      const decoder = new (require('util').TextDecoder)('utf-8');
      let buffer = '';

      for await (const chunk of response.data) {
        buffer += decoder.decode(chunk, { stream: true });
        
        while (buffer.includes('\n')) {
          const index = buffer.indexOf('\n');
          const line = buffer.substring(0, index);
          buffer = buffer.substring(index + 1);

          if (line.trim() === '[DONE]') {
            onComplete({ inputTokens, outputTokens });
            return;
          }

          if (line.trim().startsWith('data: ')) {
            const dataStr = line.trim().substring(6);
            try {
              const parsed = JSON.parse(dataStr);
              const chunkContent = parsed.choices?.[0]?.delta?.content || '';
              
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens ?? parsed.usage.input_tokens;
                outputTokens = parsed.usage.completion_tokens ?? parsed.usage.output_tokens;
              }

              if (chunkContent) {
                onChunk(chunkContent);
              }
            } catch (error) {
              console.warn('流式数据解析失败:', dataStr.substring(0, 100));
            }
          }
        }
      }

      onComplete({ inputTokens, outputTokens });
    } catch (error) {
      console.error('流式调用LLM失败:', error);
      onComplete({ inputTokens, outputTokens });
    }
  }

  /**
   * 解析工具调用
   * @param text LLM响应文本
   * @returns {Record<string, unknown> | null} 工具调用信息
   */
  private parseToolCall(text: string): Record<string, unknown> | null {
    try {
      // 尝试提取JSON
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.skill) {
          return parsed;
        }
      }
    } catch {
      // 解析失败，返回null
    }
    return null;
  }
}

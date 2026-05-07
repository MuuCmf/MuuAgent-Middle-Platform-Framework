import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { SkillService } from '../skill/skill.service';
import { ModelService } from '../model/model.service';
import { AgentKbService } from './agent-kb.service';
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
   * @param mcpServerService MCP Server服务
   * @param skillService 技能服务
   * @param modelService 模型服务
   * @param agentKbService 智能体知识库服务
   */
  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private mcpServerService: McpServerService,
    private skillService: SkillService,
    private modelService: ModelService,
    private agentKbService: AgentKbService,
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
        mcpServers: dto.mcpServers || '[]',
        knowledgeBases: dto.knowledgeBases || '[]',
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

    // 获取绑定的MCP Server工具
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);
    const mcpTools = mcpServerConfigs.length > 0
      ? await this.mcpServerService.discoverAllTools(mcpServerConfigs)
      : [];
    const mcpToolDescriptions = mcpTools.length > 0
      ? this.mcpServerService.buildToolsDescription(mcpTools)
      : '';

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    let augmentedPrompt = agent.systemPrompt;
    let kbSources: any[] = [];

    if (kbCodes.length > 0) {
      const augmentation = await this.agentKbService.augmentPromptWithKb(
        agent.id,
        dto.message,
        agent.systemPrompt,
      );
      augmentedPrompt = augmentation.systemPrompt;
      kbSources = augmentation.sources;
    }

    const systemPrompt = this.buildSystemPrompt(
      { ...agent, systemPrompt: augmentedPrompt },
      skillDescriptions,
      mcpToolDescriptions,
    );

    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    const originalMessage = dto.message;
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

        // 执行工具调用
        const isMcpTool = (toolCall.skill as string).startsWith('mcp:');
        const toolType = isMcpTool ? 'MCP工具' : '技能';
        
        steps.push({
          step: step + 1,
          action: `调用${toolType}: ${toolCall.skill}`,
          result: null,
        });

        try {
          let toolResult: unknown;
          
          if (isMcpTool) {
            // 调用MCP工具
            toolResult = await this.mcpServerService.callTool(
              mcpServerConfigs,
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            // 调用技能
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;

          // 将工具结果返回给LLM继续处理
          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}

【工具调用结果】
工具名称: ${toolCall.skill}
执行结果:
${resultText}

请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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

    // 获取绑定的MCP Server工具
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);
    const mcpTools = mcpServerConfigs.length > 0
      ? await this.mcpServerService.discoverAllTools(mcpServerConfigs)
      : [];
    const mcpToolDescriptions = mcpTools.length > 0
      ? this.mcpServerService.buildToolsDescription(mcpTools)
      : '';

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    let augmentedPrompt = agent.systemPrompt;
    let kbSources: any[] = [];

    if (kbCodes.length > 0) {
      const augmentation = await this.agentKbService.augmentPromptWithKb(
        agent.id,
        dto.message,
        agent.systemPrompt,
      );
      augmentedPrompt = augmentation.systemPrompt;
      kbSources = augmentation.sources;
    }

    const systemPrompt = this.buildSystemPrompt(
      { ...agent, systemPrompt: augmentedPrompt },
      skillDescriptions,
      mcpToolDescriptions,
    );

    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    const originalMessage = dto.message;
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
        const chunks: string[] = [];
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(model, systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            chunks.push(chunk);
          }, resolve);
        });

        // 累加token用量
        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        // 解析是否需要调用工具
        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不需要调用工具，发送缓存的chunk
          for (const chunk of chunks) {
            sendChunk({ type: 'chunk', content: chunk });
          }
          finalResponse = llmResponse;
          break;
        }

        // 执行工具调用
        const isMcpTool = (toolCall.skill as string).startsWith('mcp:');
        const toolType = isMcpTool ? 'MCP工具' : '技能';
        
        steps.push({
          step: step + 1,
          action: `调用${toolType}: ${toolCall.skill}`,
          result: null,
        });

        try {
          let toolResult: unknown;
          
          if (isMcpTool) {
            // 调用MCP工具
            toolResult = await this.mcpServerService.callTool(
              mcpServerConfigs,
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            // 调用技能
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;

          // 发送工具执行结果通知
          sendChunk({ type: 'tool', skill: toolCall.skill, result: toolResult });

          // 将工具结果返回给LLM继续处理
          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}

【工具调用结果】
工具名称: ${toolCall.skill}
执行结果:
${resultText}

请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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

    // 获取绑定的MCP Server工具
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);
    const mcpTools = mcpServerConfigs.length > 0
      ? await this.mcpServerService.discoverAllTools(mcpServerConfigs)
      : [];
    const mcpToolDescriptions = mcpTools.length > 0
      ? this.mcpServerService.buildToolsDescription(mcpTools)
      : '';

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    let augmentedPrompt = agent.systemPrompt;
    let kbSources: any[] = [];

    if (kbCodes.length > 0) {
      const augmentation = await this.agentKbService.augmentPromptWithKb(
        agent.id,
        dto.message,
        agent.systemPrompt,
      );
      augmentedPrompt = augmentation.systemPrompt;
      kbSources = augmentation.sources;
    }

    const systemPrompt = this.buildSystemPrompt(
      { ...agent, systemPrompt: augmentedPrompt },
      skillDescriptions,
      mcpToolDescriptions,
    );

    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    const steps: Array<{ step: number; action: string; result: unknown }> = [];
    const originalMessage = dto.message;
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
        const chunks: string[] = [];
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(model, systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            chunks.push(chunk);
          }, resolve);
        });

        // 累加token用量
        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        // 解析是否需要调用工具
        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不需要调用工具，发送缓存的chunk
          for (const chunk of chunks) {
            observer.next(new MessageEvent('message', { data: JSON.stringify({ type: 'chunk', content: chunk }) + '\n' }));
          }
          finalResponse = llmResponse;
          break;
        }

        // 执行工具调用
        const isMcpTool = (toolCall.skill as string).startsWith('mcp:');
        const toolType = isMcpTool ? 'MCP工具' : '技能';
        
        steps.push({
          step: step + 1,
          action: `调用${toolType}: ${toolCall.skill}`,
          result: null,
        });

        try {
          let toolResult: unknown;
          
          if (isMcpTool) {
            // 调用MCP工具
            toolResult = await this.mcpServerService.callTool(
              mcpServerConfigs,
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            // 调用技能
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;

          // 发送工具执行结果通知
          observer.next(new MessageEvent('message', { 
            data: JSON.stringify({ 
              type: 'tool', 
              skill: toolCall.skill, 
              result: toolResult 
            }) + '\n' 
          }));

          // 将工具结果返回给LLM继续处理
          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}

【工具调用结果】
工具名称: ${toolCall.skill}
执行结果:
${resultText}

请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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
   * @param mcpToolDescriptions MCP工具描述
   * @returns {string} 完整的系统提示词
   */
  private buildSystemPrompt(
    agent: { systemPrompt: string },
    skillDescriptions: string,
    mcpToolDescriptions: string = '',
  ): string {
    let prompt = agent.systemPrompt;

    const allToolDescriptions = [skillDescriptions, mcpToolDescriptions].filter(Boolean).join('\n\n');

    if (allToolDescriptions) {
      prompt += `\n\n你可以使用以下工具:\n${allToolDescriptions}`;
      prompt += `

【重要】工具调用规则：
1. 如果需要使用工具，请只输出JSON格式的工具调用，不要输出其他任何内容
2. 如果不需要使用工具，请直接用自然语言回答用户问题，不要输出JSON
3. JSON格式示例：
   - 调用技能工具: {"skill":"工具标识","params":{"参数名":"参数值"}}
   - 调用MCP工具: {"skill":"mcp:服务器名:工具名","params":{"参数名":"参数值"}}
   - 不调用工具: 直接回答，不要输出JSON

示例：
用户: 现在几点了？
助手: {"skill":"get_time","params":{}}

用户: 读取文件/test.txt的内容
助手: {"skill":"mcp:filesystem:read_file","params":{"path":"/test.txt"}}

用户: 你好
助手: 你好！很高兴为您服务，请问有什么可以帮助您的？`;
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
    const startTime = Date.now();

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
    let fullResponse = '';
    let success = true;
    let errorMessage: string | null = null;

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
            await this.saveAiInvokeLog(model, data, fullResponse, startTime, inputTokens, outputTokens, true, null);
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
                fullResponse += chunkContent;
                onChunk(chunkContent);
              }
            } catch (error) {
              console.warn('流式数据解析失败:', dataStr.substring(0, 100));
            }
          }
        }
      }

      await this.saveAiInvokeLog(model, data, fullResponse, startTime, inputTokens, outputTokens, true, null);
      onComplete({ inputTokens, outputTokens });
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : '调用失败';
      console.error('流式调用LLM失败:', error);
      await this.saveAiInvokeLog(model, data, fullResponse, startTime, inputTokens, outputTokens, success, errorMessage);
      onComplete({ inputTokens, outputTokens });
    }
  }

  /**
   * 保存AI调用日志
   * @param model 模型信息
   * @param requestData 请求数据
   * @param responseData 响应数据
   * @param startTime 开始时间
   * @param inputTokens 输入Token数
   * @param outputTokens 输出Token数
   * @param success 是否成功
   * @param errorMessage 错误信息
   */
  private async saveAiInvokeLog(
    model: Record<string, unknown>,
    requestData: Record<string, unknown>,
    responseData: string,
    startTime: number,
    inputTokens?: number,
    outputTokens?: number,
    success: boolean = true,
    errorMessage: string | null = null,
  ): Promise<void> {
    try {
      await this.prisma.aiInvokeLog.create({
        data: {
          modelId: model.id as string,
          modelCode: model.code as string,
          modelType: (model.type as string) || 'llm',
          request: JSON.stringify(requestData),
          response: responseData,
          costMs: Date.now() - startTime,
          inputTokens,
          outputTokens,
          success,
          errorMessage,
        },
      });
    } catch (error) {
      console.error('保存AI调用日志失败:', error);
    }
  }

  /**
   * 解析工具调用
   * @param text LLM响应文本
   * @returns {Record<string, unknown> | null} 工具调用信息
   */
  private parseToolCall(text: string): Record<string, unknown> | null {
    try {
      const trimmedText = text.trim();
      
      // 只有当整个响应是纯JSON对象时才认为是工具调用
      if (!trimmedText.startsWith('{') || !trimmedText.endsWith('}')) {
        return null;
      }
      
      // 尝试解析整个文本为JSON
      const parsed = JSON.parse(trimmedText);
      
      // 必须包含skill字段才认为是工具调用
      if (parsed.skill && typeof parsed.skill === 'string') {
        return parsed;
      }
      
      return null;
    } catch {
      // 解析失败，说明不是JSON格式，返回null
      return null;
    }
  }
}

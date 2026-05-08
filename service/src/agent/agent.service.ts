import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { SkillService } from '../skill/skill.service';
import { ModelService } from '../model/model.service';
import { AgentKbService } from './agent-kb.service';
import { OrchestratorFactory } from './orchestrator/orchestrator.factory';
import { KbSearchTool } from './tools/kb-search.tool';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import {
  ReasoningMode,
  ExecutionContext,
  ToolDefinition,
  ExecutionResult,
  ReasoningStep as ReasoningStepType,
  StepType,
} from './react/react.types';
import { ReActEngine } from './react/react.engine';
import axios from 'axios';
import { Observable, Observer } from 'rxjs';

/**
 * 智能体服务
 * 提供智能体的CRUD和对话执行功能
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private mcpService: McpService,
    private mcpServerService: McpServerService,
    private skillService: SkillService,
    private modelService: ModelService,
    private agentKbService: AgentKbService,
    private orchestratorFactory: OrchestratorFactory,
    private kbSearchTool: KbSearchTool,
    private reactEngine: ReActEngine,
  ) {}

  /**
   * 创建智能体
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
        reasoningMode: dto.reasoningMode || 'NONE',
        reasoningPrompt: dto.reasoningPrompt,
        kbRetrievalMode: dto.kbRetrievalMode || 'auto',
        kbRetrievalMethod: dto.kbRetrievalMethod || 'auto',
      },
    });
  }

  /**
   * 更新智能体
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
   */
  chat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> | Observable<MessageEvent> {
    if (dto.stream) {
      return this.streamChat(dto, clientIp, uid);
    }
    return this.syncChat(dto, clientIp, uid);
  }

  /**
   * 获取智能体（公共方法）
   */
  private async getAgent(agentId: string) {
    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: {
          OR: [{ id: agentId }, { code: agentId }],
        },
      });
    } catch {
      agent = await this.findByCode(agentId);
    }

    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    if (!agent.status) {
      throw new HttpException('智能体已禁用', HttpStatus.FORBIDDEN);
    }

    return agent;
  }

  /**
   * 准备工具列表（包含知识库检索工具）
   */
  private async prepareTools(agent: any): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    // 1. 添加知识库检索工具
    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    if (kbCodes.length > 0 && agent.kbRetrievalMode !== 'disabled') {
      const kbTool = await this.kbSearchTool.getToolDefinition(agent.id, kbCodes);
      if (kbTool) {
        tools.push(kbTool);
      }
    }

    // 2. 添加技能工具
    const skillCodes: string[] = JSON.parse(agent.skills || '[]');
    for (const code of skillCodes) {
      const skill = await this.skillService.findByCode(code);
      if (skill) {
        tools.push({
          name: skill.code,
          description: skill.description,
          parameters: JSON.parse(skill.params || '{}'),
          type: 'skill',
        });
      }
    }

    // 3. 添加 MCP 工具
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);
    if (mcpServerConfigs.length > 0) {
      const mcpTools = await this.mcpServerService.discoverAllTools(mcpServerConfigs);
      for (const tool of mcpTools) {
        tools.push({
          name: `mcp:${tool.serverName}:${tool.name}`,
          description: tool.description,
          parameters: (tool.inputSchema || {}) as Record<string, any>,
          type: 'mcp',
        });
      }
    }

    return tools;
  }

  /**
   * 构建执行上下文
   */
  private async buildExecutionContext(agent: any, dto: AgentChatDto): Promise<ExecutionContext> {
    // 获取模型
    let model;
    if (agent.modelId) {
      model = await this.modelService.findOne(agent.modelId);
    } else {
      model = await this.mcpService.selectModel('llm');
    }

    // 准备工具列表
    const tools = await this.prepareTools(agent);
    console.log('tools工具列表', tools);

    // 知识库预检索（auto模式：预检索 + 工具检索）
    let augmentedPrompt = agent.systemPrompt;
    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    if (kbCodes.length > 0 && agent.kbRetrievalMode === 'auto') {
      const augmentation = await this.agentKbService.augmentPromptWithKb(
        agent.id,
        dto.message,
        agent.systemPrompt,
      );
      augmentedPrompt = augmentation.systemPrompt;
    }

    // 获取MCP Server配置
    const mcpServerConfigs = this.mcpServerService.parseMcpServersConfig(agent.mcpServers);

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(agent, tools, augmentedPrompt);

    return {
      agent,
      model,
      userMessage: dto.message,
      systemPrompt,
      tools,
      maxSteps: agent.maxSteps,
      temperature: agent.temperature,
      mcpServerConfigs,
    };
  }

  /**
   * 构建系统提示词（根据推理模式选择不同格式）
   */
  private buildSystemPrompt(
    agent: any,
    tools: ToolDefinition[],
    augmentedPrompt?: string,
  ): string {
    const basePrompt = augmentedPrompt || agent.systemPrompt;
    const reasoningMode = agent.reasoningMode || ReasoningMode.NONE;

    // NONE模式：使用原有JSON格式提示词
    if (reasoningMode === ReasoningMode.NONE) {
      return this.buildDefaultSystemPrompt(basePrompt, tools);
    }

    // REACT/PLAN/REFLECT模式：使用ReAct提示词
    // ReAct提示词由ReActPromptBuilder处理，这里只返回基础提示词
    return basePrompt;
  }

  /**
   * 构建默认模式系统提示词
   */
  private buildDefaultSystemPrompt(basePrompt: string, tools: ToolDefinition[]): string {
    let prompt = basePrompt;

    const skillTools = tools.filter(t => t.type === 'skill');
    const mcpTools = tools.filter(t => t.type === 'mcp');

    const skillDescriptions = skillTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    const mcpToolDescriptions = mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n');

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
   * 同步Agent对话
   */
  async syncChat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    // 获取智能体
    const agent = await this.getAgent(dto.agentId);

    // 构建执行上下文
    const context = await this.buildExecutionContext(agent, dto);

    // 获取推理模式
    const reasoningMode = agent.reasoningMode || ReasoningMode.NONE;

    if (reasoningMode === ReasoningMode.NONE) {
      // 默认模式：使用原有逻辑
      return this.executeDefaultSyncChat(agent, dto, context, clientIp, uid, startTime);
    }

    // ReAct/PLAN/REFLECT模式：使用编排器
    const orchestrator = this.orchestratorFactory.getOrchestrator(reasoningMode);
    const callLLM = this.callLLMBound(context.model);

    const result = await orchestrator.execute(context, callLLM);

    // 保存日志和推理步骤
    await this.saveInvokeLogWithSteps(agent, dto, result, clientIp, uid, reasoningMode, startTime);

    return {
      response: result.response,
      steps: result.steps,
      reasoningMode,
      conversationId: dto.conversationId,
    };
  }

  /**
   * 默认模式同步对话
   */
  private async executeDefaultSyncChat(
    agent: any,
    dto: AgentChatDto,
    context: ExecutionContext,
    clientIp: string,
    uid: string | undefined,
    startTime: number,
  ): Promise<Record<string, unknown>> {
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
        const llmResult = await this.callLLM(
          context.model, context.systemPrompt, currentMessage, agent.temperature, false,
        );

        if (llmResult.inputTokens) inputTokens += llmResult.inputTokens;
        if (llmResult.outputTokens) outputTokens += llmResult.outputTokens;

        const toolCall = this.parseToolCall(llmResult.response);

        if (!toolCall) {
          finalResponse = llmResult.response;
          break;
        }

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
            toolResult = await this.mcpServerService.callTool(
              context.mcpServerConfigs || [],
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;

          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}\n\n【工具调用结果】\n工具名称: ${toolCall.skill}\n执行结果:\n${resultText}\n\n请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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
        reasoningMode: ReasoningMode.NONE,
      },
    });

    return {
      response: finalResponse,
      steps,
      reasoningMode: ReasoningMode.NONE,
      conversationId: dto.conversationId,
    };
  }

  /**
   * 流式Agent对话（使用Response对象）
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
      agent = await this.getAgent(dto.agentId);
    } catch (error) {
      res.write(JSON.stringify({ type: 'error', content: error.message }) + '\n');
      res.end();
      return;
    }

    // 构建执行上下文
    const context = await this.buildExecutionContext(agent, dto);
    const reasoningMode = agent.reasoningMode || ReasoningMode.NONE;

    const sendChunk = (data: any) => {
      const jsonData = JSON.stringify(data) + '\n';
      //console.log('[Stream] Writing to response:', jsonData.trim());
      res.write(jsonData);
      // 强制刷新缓冲区，确保数据立即发送
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    // ReAct/PLAN/REFLECT模式：使用编排器流式执行
    if (reasoningMode !== ReasoningMode.NONE) {
      try {
        const reactEngine = this.reactEngine;
        const callLLMStream = this.callLLMStreamBound(context.model);

        await reactEngine.executeStream(
          context,
          callLLMStream,
          {
            onStep: (step) => {
              sendChunk({ type: 'reasoning_step', step });
            },
            onChunk: (chunk) => {
              sendChunk({ type: 'chunk', content: chunk });
            },
            onDone: async (result) => {
              // 保存日志
              await this.saveInvokeLogWithSteps(agent, dto, result, clientIp, uid, reasoningMode, startTime);
              sendChunk({ type: 'done', content: result.response, steps: result.steps, reasoningMode });
              res.end();
            },
            onError: (error) => {
              sendChunk({ type: 'error', content: error });
              res.end();
            },
          },
        );
      } catch (error) {
        sendChunk({ type: 'error', content: error instanceof Error ? error.message : '执行失败' });
        res.end();
      }
      return;
    }

    // 默认模式：原有流式逻辑
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
        let llmResponse = '';
        let isToolCallJson = false;
        let toolCallJsonBuffer = '';
        let pendingChunks: string[] = [];
        let jsonStartDetected = false;
        
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(context.model, context.systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            
            // 如果已经检测到是工具调用 JSON，继续收集直到 JSON 结束
            if (isToolCallJson) {
              toolCallJsonBuffer += chunk;
              if (chunk === '}') {
                // JSON 完成，跳过所有缓存的 chunks
                return;
              }
              return;
            }
            
            // 检测工具调用 JSON 开始
            if (!jsonStartDetected && (chunk === '{' || llmResponse.trim().startsWith('{"'))) {
              jsonStartDetected = true;
              pendingChunks = [chunk];
              return;
            }
            
            // 如果已开始检测 JSON，继续缓存
            if (jsonStartDetected) {
              pendingChunks.push(chunk);
              // 检查是否以 } 结尾（JSON 可能完成）
              if (chunk === '}') {
                const fullJson = pendingChunks.join('');
                const trimmed = fullJson.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                  const parsed = this.parseToolCall(trimmed);
                  if (parsed) {
                    // 是工具调用 JSON，跳过所有缓存的 chunks
                    isToolCallJson = true;
                    toolCallJsonBuffer = fullJson;
                    return;
                  }
                }
                // 不是工具调用 JSON，发送所有缓存的 chunks
                for (const c of pendingChunks) {
                  sendChunk({ type: 'chunk', content: c });
                }
                pendingChunks = [];
                jsonStartDetected = false;
              }
              return;
            }
            
            // 实时发送 chunk 给客户端，实现真正的流式输出
            sendChunk({ type: 'chunk', content: chunk });
          }, resolve);
        });

        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不是工具调用，直接结束
          finalResponse = llmResponse;
          break;
        }

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
            toolResult = await this.mcpServerService.callTool(
              context.mcpServerConfigs || [],
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;
          sendChunk({ type: 'tool', skill: toolCall.skill, result: toolResult });

          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}\n\n【工具调用结果】\n工具名称: ${toolCall.skill}\n执行结果:\n${resultText}\n\n请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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
        reasoningMode: ReasoningMode.NONE,
      },
    });

    sendChunk({ type: 'done', content: finalResponse, steps });
    res.end();
  }

  /**
   * 流式Agent对话（Observable版本，保留兼容）
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
      agent = await this.getAgent(dto.agentId);
    } catch (error) {
      observer.error(error);
      return;
    }

    const context = await this.buildExecutionContext(agent, dto);
    const reasoningMode = agent.reasoningMode || ReasoningMode.NONE;

    // ReAct模式
    if (reasoningMode !== ReasoningMode.NONE) {
      try {
        const orchestrator = this.orchestratorFactory.getOrchestrator(reasoningMode);
        const callLLM = this.callLLMBound(context.model);
        const result = await orchestrator.execute(context, callLLM);

        // 发送推理步骤
        for (const step of result.steps) {
          observer.next(new MessageEvent('message', {
            data: JSON.stringify({ type: 'reasoning_step', step }) + '\n',
          }));
        }

        // 发送最终响应
        observer.next(new MessageEvent('message', {
          data: JSON.stringify({ type: 'chunk', content: result.response }) + '\n',
        }));

        // 保存日志
        await this.saveInvokeLogWithSteps(agent, dto, result, clientIp, uid, reasoningMode, startTime);

        observer.next(new MessageEvent('message', {
          data: JSON.stringify({ type: 'done', content: result.response, steps: result.steps, reasoningMode }) + '\n',
        }));
      } catch (error) {
        observer.next(new MessageEvent('message', {
          data: JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : '执行失败' }) + '\n',
        }));
      }
      observer.complete();
      return;
    }

    // 默认模式
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
        let llmResponse = '';
        const tokenInfo = await new Promise<{ inputTokens?: number; outputTokens?: number }>((resolve) => {
          this.callLLMStream(context.model, context.systemPrompt, currentMessage, agent.temperature, (chunk) => {
            llmResponse += chunk;
            // 实时发送 chunk 给客户端，实现真正的流式输出
            observer.next(new MessageEvent('message', { data: JSON.stringify({ type: 'chunk', content: chunk }) + '\n' }));
          }, resolve);
        });

        if (tokenInfo.inputTokens) inputTokens += tokenInfo.inputTokens;
        if (tokenInfo.outputTokens) outputTokens += tokenInfo.outputTokens;

        const toolCall = this.parseToolCall(llmResponse);

        if (!toolCall) {
          // 不是工具调用，直接结束
          finalResponse = llmResponse;
          break;
        }

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
            toolResult = await this.mcpServerService.callTool(
              context.mcpServerConfigs || [],
              toolCall.skill as string,
              (toolCall.params as Record<string, unknown>) || {},
            );
          } else {
            toolResult = await this.skillService.execute({
              skillCode: toolCall.skill as string,
              params: (toolCall.params as Record<string, unknown>) || {},
            });
          }

          steps[steps.length - 1].result = toolResult;

          observer.next(new MessageEvent('message', {
            data: JSON.stringify({ type: 'tool', skill: toolCall.skill, result: toolResult }) + '\n',
          }));

          const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
          currentMessage = `用户问题: ${originalMessage}\n\n【工具调用结果】\n工具名称: ${toolCall.skill}\n执行结果:\n${resultText}\n\n请根据以上工具执行结果，用自然语言回答用户的问题。不要提及工具调用的细节，直接给出答案。`;
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
        reasoningMode: ReasoningMode.NONE,
      },
    });

    observer.next(new MessageEvent('message', {
      data: JSON.stringify({ type: 'done', content: finalResponse, steps }) + '\n',
    }));
    observer.complete();
  }

  /**
   * 保存调用日志和推理步骤
   */
  private async saveInvokeLogWithSteps(
    agent: any,
    dto: AgentChatDto,
    result: ExecutionResult,
    clientIp: string,
    uid: string | undefined,
    reasoningMode: string,
    startTime: number,
  ): Promise<void> {
    // 保存调用日志
    const invokeLog = await this.prisma.agentInvokeLog.create({
      data: {
        agentId: agent.id,
        conversationId: dto.conversationId,
        userMessage: dto.message,
        agentResponse: result.response,
        steps: JSON.stringify(result.steps),
        totalCostMs: Date.now() - startTime,
        success: result.success,
        errorMessage: result.errorMessage,
        clientIp,
        uid,
        inputTokens: result.inputTokens || undefined,
        outputTokens: result.outputTokens || undefined,
        reasoningMode,
      },
    });

    // 保存推理步骤
    if (result.steps && result.steps.length > 0) {
      await this.prisma.reasoningStep.createMany({
        data: result.steps.map((step) => ({
          agentLogId: invokeLog.id,
          stepNumber: step.stepNumber,
          stepType: step.stepType,
          content: step.content || step.thought || '',
          thought: step.thought,
          action: step.action,
          actionInput: step.actionInput ? JSON.stringify(step.actionInput) : undefined,
          observation: step.observation,
          toolOutput: step.toolOutput ? JSON.stringify(step.toolOutput) : undefined,
          costMs: step.costMs,
        })),
      });
    }
  }

  /**
   * 创建绑定this的callLLM函数
   */
  private callLLMBound(model: any) {
    return async (systemPrompt: string, userMessage: string) => {
      return this.callLLM(model, systemPrompt, userMessage, model.temperature || 0.7, false);
    };
  }

  /**
   * 创建绑定this的callLLMStream函数
   */
  private callLLMStreamBound(model: any) {
    return async (
      systemPrompt: string,
      userMessage: string,
      onChunk: (chunk: string) => void,
    ): Promise<{ response: string; inputTokens?: number; outputTokens?: number }> => {
      return new Promise((resolve) => {
        let fullResponse = '';
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        this.callLLMStream(
          model,
          systemPrompt,
          userMessage,
          model.temperature || 0.7,
          (chunk: string) => {
            fullResponse += chunk;
            onChunk(chunk);
          },
          (tokenInfo: { inputTokens?: number; outputTokens?: number }) => {
            inputTokens = tokenInfo.inputTokens;
            outputTokens = tokenInfo.outputTokens;
            resolve({
              response: fullResponse,
              inputTokens,
              outputTokens,
            });
          },
        );
      });
    };
  }

  /**
   * 调用LLM
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

              // 支持多种流式响应格式
              // OpenAI 格式: choices[0].delta.content
              // 其他格式: choices[0].message.content 或 choices[0].text
              const choice = parsed.choices?.[0];
              const chunkContent = choice?.delta?.content
                || choice?.message?.content
                || choice?.text
                || '';

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
   */
  private parseToolCall(text: string): Record<string, unknown> | null {
    try {
      const trimmedText = text.trim();

      if (!trimmedText.startsWith('{') || !trimmedText.endsWith('}')) {
        return null;
      }

      const parsed = JSON.parse(trimmedText);

      if (parsed.skill && typeof parsed.skill === 'string') {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }
}

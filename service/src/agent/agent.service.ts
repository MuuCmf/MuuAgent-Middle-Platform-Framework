import { Injectable, Logger, NotFoundException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SkillService } from '../skill/skill.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { McpService } from '../mcp/mcp.service';
import { AgentKbService } from './agent-kb.service';
import { KbSearchTool } from './tools/kb-search.tool';
import { ToolExecutor, ToolCall, ToolExecutionResult } from './tools/tool-executor';
import { ToolDefinitionBuilder, FunctionToolDefinition, BUILTIN_TOOL_DEFINITIONS } from './tools/tool-definitions';
import { ReasoningMode, ExecutionResult, ToolDefinition } from './react/react.types';
import { ReActPromptBuilder } from './react/react.prompt';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import { IsolationContext, buildIsolationWhere, buildCreateData, buildOwnerWhere } from '../common/utils/isolation.util';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import { AiService } from '../ai/ai.service';
import { AiSdkToolAdapter } from '../ai/providers/ai-sdk-tool.adapter';
import type { ModelMessage } from 'ai';

/**
 * 流式回调接口
 * 包含流式回调函数，用于处理智能体对话中的不同事件
 */
export interface StreamCallbacks {
  onConversationId?: (conversationId: string) => void;
  onStep?: (step: any) => void;
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolCall: { name: string; args: any; result: unknown }) => void;
  onDone?: (result: ExecutionResult) => void;
  onError?: (error: string) => void;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private skillService: SkillService,
    private mcpServerService: McpServerService,
    private agentKbService: AgentKbService,
    private kbSearchTool: KbSearchTool,
    private toolExecutor: ToolExecutor,
    private aiService: AiService,
    private promptTemplateService: PromptTemplateService,
    private conversationService: ConversationService,
    private mcpService: McpService,
  ) {}

  async create(dto: CreateAgentDto, context?: IsolationContext) {
    const data = buildCreateData({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      skills: dto.skills || '[]',
      mcpServers: dto.mcpServers || '[]',
      knowledgeBases: dto.knowledgeBases || '[]',
      maxSteps: dto.maxSteps ?? 5,
      temperature: dto.temperature ?? 0.7,
      status: dto.status ?? true,
      reasoningMode: dto.reasoningMode || 'NONE',
      reasoningPrompt: dto.reasoningPrompt,
      kbRetrievalMode: 'tool',
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    return this.prisma.agent.create({ data });
  }

  async update(id: string, dto: UpdateAgentDto, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    return this.prisma.agent.update({
      where: { id: id as any },
      data: dto,
    });
  }

  async remove(id: string, context?: IsolationContext): Promise<void> {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    await this.prisma.agent.delete({ where: { id: id as any } });
  }

  async findOne(id: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({
      where: { id, ...isolationWhere },
    });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findByCode(code: string, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({
      where: { code, ...isolationWhere },
    });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findAll(query: QueryAgentDto, context?: IsolationContext) {
    const { status, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where: Record<string, unknown> = { ...isolationWhere };
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
   * 同步对话
   * @param dto 对话参数
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param appCode 应用标识
   */
   async syncChat(dto: AgentChatDto, clientIp: string, uid?: string, appCode?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    const context = await this.buildExecutionContext(agent, dto, uid, isolationContext);
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;

    if (reasoningMode === ReasoningMode.NONE) {
      return this.executeDefaultSyncChat(agent, context, startTime, clientIp, uid, appCode);
    }

    return this.executeReActWithFunctionCallingSync(agent, context, reasoningMode, startTime, clientIp, uid, appCode);
  }

  /**
   * 流式对话
   * @param dto 对话参数
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param callbacks 流式回调函数
   * @param appCode 应用标识
   */
  async streamChat(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
    appCode?: string,
  ): Promise<void> {
    this.logger.log(`[AgentStream] streamChat 开始, agentId: ${dto.agentId}`);
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    this.logger.log(`[AgentStream] 获取到智能体, id: ${agent.id}`);
    const context = await this.buildExecutionContext(agent, dto, uid, isolationContext);
    this.logger.log(`[AgentStream] 构建执行上下文完成`);
    
    if (callbacks.onConversationId && context.conversationId) {
      callbacks.onConversationId(context.conversationId as any);
    }
    
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;
    this.logger.log(`[AgentStream] reasoningMode: ${reasoningMode}`);

    if (reasoningMode === ReasoningMode.NONE) {
      this.logger.log(`[AgentStream] 执行默认流式模式`);
      await this.executeDefaultStream(agent, context, startTime, clientIp, uid, callbacks, undefined, 0, appCode);
    } else {
      this.logger.log(`[AgentStream] 执行 Function Calling + ReAct 协同架构`);
      await this.executeReActWithFunctionCalling(
        agent, 
        context, 
        reasoningMode, 
        startTime, 
        clientIp, 
        uid, 
        callbacks,
      );
    }
  }

  /**
   * 获取智能体
   * @param agentId 智能体ID或代码
   * @param context 隔离上下文
   */
  private async getAgent(agentId: string, context?: IsolationContext) {
    this.logger.log(`[AgentStream] 获取智能体: ${agentId}`);
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    
    // 将隔离条件与 id/code 条件合并为 AND 关系，避免两个 OR 同级时后者覆盖前者
    const where = {
      AND: [
        { OR: [{ id: agentId }, { code: agentId }] },
        isolationWhere,
      ],
    };

    let agent;
    try {
      agent = await this.prisma.agent.findFirst({ where });
      this.logger.log(`[AgentStream] 查询结果: ${JSON.stringify(agent)}`);
    } catch (e) {
      this.logger.error(`[AgentStream] 查询智能体失败: ${e}`);
      agent = await this.prisma.agent.findFirst({
        where: { 
          code: agentId,
          ...isolationWhere,
        },
      });
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
   * 构建执行上下文
   * @param agent 智能体
   * @param dto 对话参数
   * @param uid 用户ID
   */
  private async buildExecutionContext(agent: any, dto: AgentChatDto, uid?: string, isolationContext?: IsolationContext) {
    let model;
    
    this.logger.debug(`buildExecutionContext: dto.agentId=${dto.agentId}, agent.id=${agent.id}, agent.code=${agent.code}, dto.conversationId=${dto.conversationId}, dto.modelCode=${dto.modelCode}`);
    
    if (dto.modelCode && dto.modelCode !== 'mcp') {
      // 客户端指定了固定模型
      model = await this.prisma.model.findFirst({ where: { code: dto.modelCode, type: 'llm', status: true } });
      this.logger.debug(`使用指定模型: ${dto.modelCode}`);
    } else {
      // 使用MCP调度选择最优模型
      model = await this.mcpService.selectModel('llm');
      this.logger.debug(`MCP调度选择模型: ${model?.code || 'none'}`);
    }
    
    if (!model) {
      throw new NotFoundException('没有可用的模型');
    }

    const conversation = await this.conversationService.getOrCreate(
      ConversationType.AGENT,
      agent.id,
      dto.conversationId,
      uid,
      isolationContext,
    );

    this.logger.debug(`buildExecutionContext: conversation.id=${conversation.id as any}, conversation.targetId=${conversation.targetId}, conversation.conversationType=${conversation.conversationType}`);

    let conversationHistory: ModelMessage[] = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id as any, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    let tools: ToolDefinition[] = [];

    if (agent.mcpServers) {
      try {
        const mcpServers = JSON.parse(agent.mcpServers);
        for (const server of mcpServers) {
          if (server && server.url) {
            try {
              const toolsResult = await this.mcpServerService.discoverTools({
                url: server.url,
                apiKey: server.apiKey,
                timeout: server.timeout || 30000,
              });
              if (Array.isArray(toolsResult)) {
                tools.push(...toolsResult.map(t => ({
                  name: `mcp:${server.name || server.url}:${t.name}`,
                  description: t.description || '',
                  parameters: t.inputSchema || { type: 'object', properties: {} },
                  type: 'mcp' as const,
                })));
              }
            } catch (e) {
              this.logger.warn(`Failed to discover tools from MCP server: ${server.name}`);
            }
          }
        }
      } catch (e) {
        this.logger.warn('Failed to parse MCP servers config');
      }
    }

    if (agent.skills) {
      try {
        const skillCodes = JSON.parse(agent.skills);
        for (const code of skillCodes) {
          try {
            const skill = await this.skillService.findByCode(code, isolationContext);
            if (skill) {
              tools.push({
                name: skill.code,
                description: skill.description || '',
                parameters: skill.params ? JSON.parse(skill.params) : { type: 'object', properties: {} },
                type: 'skill',
              });
            }
          } catch (e) {
            this.logger.warn(`Skill not found: ${code}`);
          }
        }
      } catch (e) {
        this.logger.warn('Failed to parse skills config');
      }
    }

    const kbCodes: string[] = JSON.parse(agent.knowledgeBases || '[]');
    if (kbCodes.length > 0) {
      const kbTool = await this.kbSearchTool.getToolDefinition(agent.id, kbCodes);
      if (kbTool) {
        tools.push(kbTool);
      }
    }

    for (const [name, def] of Object.entries(BUILTIN_TOOL_DEFINITIONS)) {
      if (!tools.some(t => t.name === name)) {
        tools.push({
          name: def.function.name,
          description: def.function.description,
          parameters: def.function.parameters as Record<string, any>,
          type: 'builtin',
        });
      }
    }

    let templateCode = agent.promptTemplateCode;
    
    if (!templateCode) {
      switch (agent.reasoningMode) {
        case 'REACT':
          templateCode = 'react-reasoning-default';
          break;
        case 'PLAN':
          templateCode = 'plan-reasoning-default';
          break;
        case 'REFLECT':
          templateCode = 'reflect-reasoning-default';
          break;
        default:
          templateCode = 'agent-system-default';
      }
    }

    const hasTools = tools.length > 0;
    const toolsDescription = hasTools ? JSON.stringify(tools, null, 2) : '';

    let systemPrompt: string;
    try {
      systemPrompt = await this.promptTemplateService.render(templateCode, {
        basePrompt: agent.systemPrompt || '你是一个MuuAI开发的有帮助的AI助手。',
        hasTools: hasTools,
        tools: toolsDescription
      });
    } catch (error) {
      this.logger.warn(`Failed to render prompt template: ${templateCode}, fallback to default`);
      systemPrompt = ReActPromptBuilder.buildSystemPrompt(
        agent.systemPrompt || '你是一个MuuAI开发的有帮助的AI助手。',
        tools,
      );
    }

    return {
      agent,
      model,
      userMessage: dto.message,
      systemPrompt,
      tools,
      maxSteps: agent.maxSteps || 5,
      temperature: agent.temperature || 0.7,
      conversationHistory,
      conversation,
      conversationId: conversation.id,
    };
  }

  private async executeDefaultSyncChat(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    } catch (error) {
      this.logger.error('保存用户消息失败:', error);
    }

    try {
      const result = await this.aiService.generateText({
        model: context.model,
        system: context.systemPrompt,
        messages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
        appCode,
      });

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        result.text,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(agent, context, { text: result.text }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);

      return {
        response: result.text,
        steps: [],
        reasoningMode: ReasoningMode.NONE,
        conversationId: context.conversationId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '执行失败';
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: errorMsg,
          steps: '[]',
          totalCostMs: Date.now() - startTime,
          success: false,
          errorMessage: errorMsg,
          clientIp,
          uid,
          reasoningMode: ReasoningMode.NONE,
          appCode,
        },
      });

      return {
        response: errorMsg,
        steps: [],
        reasoningMode: ReasoningMode.NONE,
        conversationId: context.conversationId,
      };
    }
  }

  /**
   * 执行默认流式模式
   * @param agent 智能体
   * @param context 执行上下文
   * @param startTime 开始时间
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param callbacks 流式回调
   * @param messages 已发送消息
   * @param toolCallCount 已调用工具次数
   */
  private async executeDefaultStream(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
    messages?: ModelMessage[],
    toolCallCount: number = 0,
    appCode?: string,
  ): Promise<void> {
    const maxToolCalls = 3;
    
    const currentMessages = messages || [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    if (!messages) {
      this.logger.log(`[executeDefaultStream] 开始执行默认流式模式，tools count: ${Object.keys(tools).length}`);
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );
    }

    try {
      let toolCallToExecute: { name: string; args: any } | null = null;

      await this.aiService.streamText({
        model: context.model,
        system: context.systemPrompt,
        messages: currentMessages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
        appCode,
        onChunk: (chunk) => {
          this.logger.debug(`[executeDefaultStream] 收到 chunk: ${chunk.substring(0, 50)}...`);
          callbacks.onChunk?.(chunk);
        },
        onToolCall: (toolCall) => {
          this.logger.log(`[executeDefaultStream] 收到工具调用: ${toolCall.name}`);
          toolCallToExecute = toolCall;
        },
        onFinish: async (result) => {
          this.logger.log(`[executeDefaultStream] 收到 finish，text length: ${result.text?.length || 0}, toolCallToExecute: ${toolCallToExecute?.name || 'none'}`);

          const isFunctionCallText = this.aiService.getToolCallParser().containsFunctionCallMarkers(result.text || '');
          const hasToolCall = toolCallToExecute || isFunctionCallText;

          if (hasToolCall && toolCallCount < maxToolCalls) {
            const parsedToolCall = this.aiService.getToolCallParser().parseFromText(result.text || '');
            const toolCall = toolCallToExecute || (parsedToolCall ? { name: parsedToolCall.toolName, args: parsedToolCall.args } : null);

            if (toolCall) {
              try {
                const toolResult = await this.toolExecutor.executeToolCall(
                  {
                    id: `tc_${Date.now()}`,
                    function: {
                      name: toolCall.name,
                      arguments: JSON.stringify(toolCall.args),
                    },
                  },
                  { agent: context.agent, conversationId: context.conversationId, uid },
                );

                callbacks.onToolCall?.({
                  name: toolCall.name,
                  args: toolCall.args,
                  result: toolResult.result,
                });

                const resultText = typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : String(toolResult.result);

                const newMessages: ModelMessage[] = [
                  ...currentMessages,
                  {
                    role: 'assistant' as const,
                    content: `Action: ${toolCall.name}\nAction Input: ${JSON.stringify(toolCall.args)}\nObservation: ${resultText}`,
                  },
                  {
                    role: 'user' as const,
                    content: `请基于工具返回结果用自然语言回答用户问题。工具返回: ${resultText}`,
                  },
                ];

                await this.executeDefaultStream(agent, context, startTime, clientIp, uid, callbacks, newMessages, toolCallCount + 1, appCode);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
                this.logger.error(`[executeDefaultStream] 工具执行失败: ${errorMsg}`);

                callbacks.onToolCall?.({
                  name: toolCall.name,
                  args: toolCall.args,
                  result: `工具执行失败: ${errorMsg}`,
                });

                await this.saveLog(agent, context, { text: `抱歉，工具执行失败: ${errorMsg}` }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
                callbacks.onDone?.({
                  success: false,
                  response: `抱歉，工具执行失败: ${errorMsg}`,
                  steps: [],
                  totalCostMs: Date.now() - startTime,
                  conversationId: context.conversationId,
                });
              }
              return;
            }
          }

          if (result.text && result.text.length > 0) {
            const cleanText = this.aiService.getToolCallParser().stripFunctionCallMarkers(result.text);

            if (cleanText) {
              await this.conversationService.addMessage(
                context.conversationId,
                'assistant',
                cleanText,
              );
            }

            if (context.conversationHistory.length === 0 && !messages) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(agent, context, { text: cleanText || result.text }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
            callbacks.onDone?.({
              success: true,
              response: cleanText || '',
              steps: [],
              totalCostMs: Date.now() - startTime,
              conversationId: context.conversationId,
            });
          } else {
            const finalResponse = result.text || '抱歉，我无法回答您的问题。';

            await this.conversationService.addMessage(
              context.conversationId,
              'assistant',
              finalResponse,
            );

            if (context.conversationHistory.length === 0 && !messages) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(agent, context, { text: finalResponse }, clientIp, uid, ReasoningMode.NONE, startTime, appCode);
            callbacks.onDone?.({
              success: true,
              response: finalResponse,
              steps: [],
              totalCostMs: Date.now() - startTime,
              conversationId: context.conversationId,
            });
          }
        },
        onError: (error) => {
          this.logger.error(`[executeDefaultStream] 收到错误: ${error}`);
          callbacks.onError?.(error);
        },
      });
    } catch (error) {
      this.logger.error(`[executeDefaultStream] 异常: ${error instanceof Error ? error.message : error}`);
      callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 保存对话日志
   * @param agent 智能体配置
   * @param context 执行上下文
   * @param result 对话结果
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param reasoningMode 推理模式
   * @param startTime 开始时间
   */
  private async saveLog(
    agent: any,
    context: any,
    result: any,
    clientIp: string,
    uid: string | undefined,
    reasoningMode: ReasoningMode,
    startTime: number,
    appCode?: string,
  ): Promise<void> {
    try {
      await this.prisma.agentInvokeLog.create({
        data: {
          agentId: agent.id,
          conversationId: context.conversationId,
          userMessage: context.userMessage,
          agentResponse: result.text || result.response || '',
          steps: JSON.stringify(result.steps || []),
          totalCostMs: Date.now() - startTime,
          success: true,
          clientIp,
          uid,
          reasoningMode,
          appCode,
        },
      });
    } catch (e) {
      this.logger.error('Failed to save log:', e);
    }
  }

  /**
   * 使用 Function Calling + ReAct 协同架构执行智能体对话
   * 这是新的推荐方法，替代旧的文本解析方式
   * @param agent 智能体配置
   * @param context 执行上下文
   * @param reasoningMode 推理模式
   * @param startTime 开始时间
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param callbacks 流式回调函数
   */
  private async executeReActWithFunctionCalling(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
    appCode?: string,
  ): Promise<void> {
    this.logger.log(`[ReAct+FC] 开始执行协同架构, reasoningMode: ${reasoningMode}`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: any[] = [];
    let finalResponse = '';

    // 将工具转换为 Function Calling 格式
    const functionTools = ToolDefinitionBuilder.convertToFunctionCallingFormat(context.tools);
    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      // ReAct 推理循环
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct+FC] Step ${i + 1}/${context.maxSteps}`);

        let stepText = '';
        let hasToolCall = false;

        // 调用模型（使用 Function Calling）
        await this.aiService.streamText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
          appCode,
          onChunk: (chunk) => {
            stepText += chunk;
            callbacks.onChunk?.(chunk);
          },
          onToolCall: async (toolCall: { name: string; args: any }) => {
            this.logger.log(`[ReAct+FC] 检测到工具调用: ${toolCall.name}`);
            hasToolCall = true;

            // 记录推理步骤
            const thoughtStep = {
              stepNumber: steps.length + 1,
              stepType: 'thought',
              content: stepText || `需要调用工具 ${toolCall.name}`,
            };
            steps.push(thoughtStep);
            callbacks.onStep?.(thoughtStep);

            // 记录行动步骤
            const actionStep = {
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${toolCall.name}`,
              action: toolCall.name,
              actionInput: toolCall.args,
            };
            steps.push(actionStep);
            callbacks.onStep?.(actionStep);

            // 执行工具
            const toolResult = await this.toolExecutor.executeToolCall(
              {
                id: `tc_${Date.now()}`,
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.args),
                },
              },
              { agent: context.agent, conversationId: context.conversationId, uid },
            );

            // 发送工具调用信息给前端
            callbacks.onToolCall?.({
              name: toolCall.name,
              args: toolCall.args,
              result: toolResult.result,
            });

            // 记录观察步骤
            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            const observationStep = {
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
              toolOutput: toolResult.result,
            };
            steps.push(observationStep);
            callbacks.onStep?.(observationStep);

            // 添加工具结果到消息历史
            messages.push({
              role: 'assistant',
              content: stepText,
            });
            messages.push({
              role: 'user',
              content: `工具 ${toolCall.name} 返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。如果已经得到答案，直接给出最终答案。`,
            });
          },
        });

        // 如果没有工具调用，说明已经得到最终答案
        if (!hasToolCall) {
          finalResponse = stepText.trim();
          
          const finalStep = {
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          };
          steps.push(finalStep);
          callbacks.onStep?.(finalStep);
          break;
        }
      }

      // 保存对话消息
      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      // 新会话生成标题
      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      // 保存日志
      await this.saveLog(agent, context, { response: finalResponse, steps }, clientIp, uid, reasoningMode, startTime, appCode);

      // 返回最终结果
      callbacks.onDone?.({
        success: true,
        response: finalResponse,
        steps,
        totalCostMs: Date.now() - startTime,
        conversationId: context.conversationId,
      });

      this.logger.log(`[ReAct+FC] 执行完成, 耗时: ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ReAct+FC] 执行失败:`, errorMsg);
      callbacks.onError?.(errorMsg);
    }
  }

  /**
   * 使用 Function Calling + ReAct 协同架构执行智能体对话（同步版本）
   * @param agent 智能体配置
   * @param context 执行上下文
   * @param reasoningMode 推理模式
   * @param startTime 开始时间
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @returns 执行结果
   */
  private async executeReActWithFunctionCallingSync(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    appCode?: string,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`[ReAct+FC Sync] 开始执行协同架构, reasoningMode: ${reasoningMode}`);

    const messages: ModelMessage[] = [
      ...context.conversationHistory,
      { role: 'user', content: context.userMessage },
    ];

    const steps: any[] = [];
    let finalResponse = '';

    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      // ReAct 推理循环
      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`[ReAct+FC Sync] Step ${i + 1}/${context.maxSteps}`);

        // 调用模型（使用 Function Calling）
        const result = await this.aiService.generateText({
          model: context.model,
          system: context.systemPrompt,
          messages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
          appCode,
        });

        const stepText = result.text;

        // 检查是否有工具调用
        if (result.toolCalls && result.toolCalls.length > 0) {
          // 记录推理步骤
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'thought',
            content: stepText || `需要调用工具`,
          });

          // 执行工具
          for (const toolCall of result.toolCalls) {
            const toolResult = await this.toolExecutor.executeToolCall(
              {
                id: toolCall.toolCallId || `tc_${Date.now()}`,
                function: {
                  name: toolCall.toolName,
                  arguments: JSON.stringify(toolCall.args),
                },
              },
              { agent: context.agent, conversationId: context.conversationId, uid },
            );

            // 记录行动步骤
            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'action',
              content: `调用工具: ${toolCall.toolName}`,
              action: toolCall.toolName,
              actionInput: toolCall.args,
            });

            // 记录观察步骤
            const resultText = typeof toolResult.result === 'object'
              ? JSON.stringify(toolResult.result, null, 2)
              : String(toolResult.result);

            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'observation',
              content: resultText,
              observation: resultText,
              toolOutput: toolResult.result,
            });

            // 添加工具结果到消息历史
            messages.push({
              role: 'assistant',
              content: [
                { type: 'text', text: stepText || '' },
                {
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                },
              ],
            } as any);
            messages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId || `tc_${Date.now()}`,
                  toolName: toolCall.toolName,
                  result: resultText,
                },
              ],
            } as any);
          }
        } else {
          // 没有工具调用，返回最终答案
          finalResponse = stepText.trim();
          
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          });
          break;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法在有限的步骤内完成您的请求。';
      }

      // 保存对话消息
      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
      );

      // 新会话生成标题
      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      // 保存日志
      await this.saveLog(agent, context, { response: finalResponse, steps }, clientIp, uid, reasoningMode, startTime, appCode);

      this.logger.log(`[ReAct+FC Sync] 执行完成, 耗时: ${Date.now() - startTime}ms`);

      return {
        response: finalResponse,
        steps,
        reasoningMode,
        conversationId: context.conversationId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ReAct+FC Sync] 执行失败:`, errorMsg);

      return {
        response: `执行失败: ${errorMsg}`,
        steps,
        reasoningMode,
        conversationId: context.conversationId,
      };
    }
  }
}
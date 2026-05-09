import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SkillService } from '../skill/skill.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ModelService } from '../model/model.service';
import { AgentKbService } from './agent-kb.service';
import { KbSearchTool } from './tools/kb-search.tool';
import { ReasoningMode, ExecutionResult, ToolDefinition } from './react/react.types';
import { ReActPromptBuilder } from './react/react.prompt';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import { AiSdkProvider } from '../ai/providers/ai-sdk.provider';
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
    private modelService: ModelService,
    private agentKbService: AgentKbService,
    private kbSearchTool: KbSearchTool,
    private aiSdkProvider: AiSdkProvider,
    private promptTemplateService: PromptTemplateService,
    private conversationService: ConversationService,
  ) {}

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
        kbRetrievalMode: 'tool',
      },
    });
  }

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

  async remove(id: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }

    await this.prisma.agent.delete({ where: { id } });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findByCode(code: string) {
    const agent = await this.prisma.agent.findUnique({ where: { code } });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

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

  async syncChat(dto: AgentChatDto, clientIp: string, uid?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const agent = await this.getAgent(dto.agentId);
    const context = await this.buildExecutionContext(agent, dto, uid);
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;

    if (reasoningMode === ReasoningMode.NONE) {
      return this.executeDefaultSyncChat(agent, context, startTime, clientIp, uid);
    }

    return this.executeReActSync(agent, context, reasoningMode, startTime, clientIp, uid);
  }

  /**
   * 流式对话
   * @param dto 对话参数
   * @param clientIp 客户端IP
   * @param uid 用户ID
   * @param callbacks 流式回调函数
   */
  async streamChat(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    this.logger.log(`[AgentStream] streamChat 开始, agentId: ${dto.agentId}`);
    const startTime = Date.now();
    const agent = await this.getAgent(dto.agentId);
    this.logger.log(`[AgentStream] 获取到智能体, id: ${agent.id}`);
    const context = await this.buildExecutionContext(agent, dto, uid);
    this.logger.log(`[AgentStream] 构建执行上下文完成`);
    
    if (callbacks.onConversationId && context.conversationId) {
      callbacks.onConversationId(context.conversationId);
    }
    
    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;
    this.logger.log(`[AgentStream] reasoningMode: ${reasoningMode}`);

    if (reasoningMode === ReasoningMode.NONE) {
      this.logger.log(`[AgentStream] 执行默认流式模式`);
      await this.executeDefaultStream(agent, context, startTime, clientIp, uid, callbacks);
    } else {
      this.logger.log(`[AgentStream] 执行ReAct流式模式`);
      await this.executeReActStream(agent, context, reasoningMode, startTime, clientIp, uid, callbacks);
    }
  }

  private async getAgent(agentId: string) {
    this.logger.log(`[AgentStream] 获取智能体: ${agentId}`);
    let agent;
    try {
      agent = await this.prisma.agent.findFirst({
        where: { OR: [{ id: agentId }, { code: agentId }] },
      });
      this.logger.log(`[AgentStream] 查询结果: ${JSON.stringify(agent)}`);
    } catch (e) {
      this.logger.error(`[AgentStream] 查询智能体失败: ${e}`);
      agent = await this.prisma.agent.findFirst({
        where: { code: agentId },
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

  private async buildExecutionContext(agent: any, dto: AgentChatDto, uid?: string) {
    let model;
    try {
      this.logger.debug(`buildExecutionContext: agent.modelId=${agent.modelId}`);
      model = await this.modelService.findByCode(agent.modelId || 'gpt-4');
      this.logger.debug(`模型查询成功: model.code=${model.code}, provider=${model.provider}`);
    } catch {
      this.logger.warn(`模型 ${agent.modelId || 'gpt-4'} 未找到，尝试查找可用的 LLM 模型`);
      model = await this.prisma.model.findFirst({ where: { type: 'llm', status: true } });
      if (!model) {
        throw new NotFoundException('没有可用的模型');
      }
    }

    const conversation = await this.conversationService.getOrCreate(
      ConversationType.AGENT,
      agent.id,
      dto.conversationId,
      uid,
    );

    let conversationHistory: ModelMessage[] = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id, 20);
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
            const skill = await this.skillService.findByCode(code);
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
        basePrompt: agent.systemPrompt || '你是一个有帮助的AI助手。',
        hasTools: hasTools,
        tools: toolsDescription
      });
    } catch (error) {
      this.logger.warn(`Failed to render prompt template: ${templateCode}, fallback to default`);
      systemPrompt = ReActPromptBuilder.buildSystemPrompt(
        agent.systemPrompt || '你是一个有帮助的AI助手。',
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
      conversationId: conversation.id,
    };
  }

  private async executeDefaultSyncChat(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
  ): Promise<Record<string, unknown>> {
    const messages: ModelMessage[] = [
      { role: 'system', content: context.systemPrompt },
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

      const result = await this.aiSdkProvider.generateText({
        model: context.model,
        messages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
      });

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        result.text,
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(agent, context, { text: result.text }, clientIp, uid, ReasoningMode.NONE, startTime);

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

  private async executeReActSync(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
  ): Promise<Record<string, unknown>> {
    const messages: ModelMessage[] = [];
    let currentPrompt = context.userMessage;
    let finalResponse = '';
    const steps: any[] = [];

    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      for (let i = 0; i < context.maxSteps; i++) {
        const stepMessages: ModelMessage[] = [
          { role: 'system', content: context.systemPrompt },
          ...context.conversationHistory,
          ...messages,
          { role: 'user', content: currentPrompt },
        ];

        const result = await this.aiSdkProvider.generateText({
          model: context.model,
          messages: stepMessages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
        });

        const stepText = result.text;

        if (stepText.includes('Final Answer:')) {
          const parts = stepText.split('Final Answer:');
          finalResponse = parts[parts.length - 1].trim();

          steps.push({
            stepNumber: i + 1,
            stepType: 'final_answer',
            content: finalResponse,
          });

          break;
        }

        steps.push({
          stepNumber: i + 1,
          stepType: 'thought',
          content: stepText,
        });

        const toolCallResult = this.parseToolCallFromText(stepText);
        if (toolCallResult && toolCallResult.toolCalls.length > 0) {
          for (const toolCall of toolCallResult.toolCalls) {
            try {
              const toolResult = await this.executeTool(toolCall.name, toolCall.args, context);
              steps[steps.length - 1].observation = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
              steps[steps.length - 1].toolOutput = toolResult;

              const resultText = steps[steps.length - 1].observation;
              messages.push({ role: 'assistant', content: stepText });
              currentPrompt = `工具 ${toolCall.name} 返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。如果已经得到答案，使用 Final Answer 输出最终答案。`;
              break;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
              steps[steps.length - 1].observation = `错误: ${errorMsg}`;
              currentPrompt = `工具执行失败: ${errorMsg}\n请尝试其他方式回答用户的问题。`;
            }
          }
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法在有限的步骤内完成您的请求。';
      }

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
        { reasoningSteps: steps },
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(agent, context, { text: finalResponse, steps }, clientIp, uid, reasoningMode, startTime);

      return {
        response: finalResponse,
        steps,
        reasoningMode,
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
          steps: JSON.stringify(steps),
          totalCostMs: Date.now() - startTime,
          success: false,
          errorMessage: errorMsg,
          clientIp,
          uid,
          reasoningMode,
        },
      });

      return {
        response: errorMsg,
        steps,
        reasoningMode,
        conversationId: context.conversationId,
      };
    }
  }

  private async executeDefaultStream(
    agent: any,
    context: any,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
    messages?: ModelMessage[],
    toolCallCount: number = 0,
  ): Promise<void> {
    const maxToolCalls = 3;
    
    const currentMessages = messages || [
      { role: 'system', content: context.systemPrompt },
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

      await this.aiSdkProvider.streamText({
        model: context.model,
        messages: currentMessages,
        tools,
        temperature: context.temperature,
        clientIp,
        userAgent: 'agent-service',
        uid,
        onChunk: (chunk) => {
          this.logger.debug(`[executeDefaultStream] 收到 chunk: ${chunk.substring(0, 50)}...`);
          callbacks.onChunk?.(chunk);
        },
        onToolCall: (toolCall) => {
          this.logger.log(`[executeDefaultStream] 收到工具调用: ${toolCall.name}`);
          toolCallToExecute = toolCall;
        },
        onFinish: async (result) => {
          this.logger.log(`[executeDefaultStream] 收到 finish，text length: ${result.text?.length || 0}`);
          
          if (result.text && result.text.length > 0) {
            await this.conversationService.addMessage(
              context.conversationId,
              'assistant',
              result.text,
            );

            if (context.conversationHistory.length === 0 && !messages) {
              await this.conversationService.generateTitle(context.conversationId);
            }

            await this.saveLog(agent, context, { text: result.text }, clientIp, uid, ReasoningMode.NONE, startTime);
            callbacks.onDone?.({
              success: true,
              response: result.text || '',
              steps: [],
              totalCostMs: Date.now() - startTime,
              conversationId: context.conversationId,
            });
          } else if (toolCallToExecute && toolCallCount < maxToolCalls) {
            try {
              const toolResult = await this.executeTool(toolCallToExecute.name, toolCallToExecute.args, context);
              
              callbacks.onToolCall?.({
                name: toolCallToExecute.name,
                args: toolCallToExecute.args,
                result: toolResult,
              });

              const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
              
              const newMessages: ModelMessage[] = [
                ...currentMessages,
                { 
                  role: 'assistant' as const, 
                  content: `Action: ${toolCallToExecute.name}\nAction Input: ${JSON.stringify(toolCallToExecute.args)}\nObservation: ${resultText}` 
                },
                { 
                  role: 'user' as const, 
                  content: `请基于工具返回结果用自然语言回答用户问题。工具返回: ${resultText}` 
                },
              ];

              await this.executeDefaultStream(agent, context, startTime, clientIp, uid, callbacks, newMessages, toolCallCount + 1);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
              this.logger.error(`[executeDefaultStream] 工具执行失败: ${errorMsg}`);
              
              callbacks.onToolCall?.({
                name: toolCallToExecute.name,
                args: toolCallToExecute.args,
                result: `工具执行失败: ${errorMsg}`,
              });

              await this.saveLog(agent, context, { text: `抱歉，工具执行失败: ${errorMsg}` }, clientIp, uid, ReasoningMode.NONE, startTime);
              callbacks.onDone?.({
                success: false,
                response: `抱歉，工具执行失败: ${errorMsg}`,
                steps: [],
                totalCostMs: Date.now() - startTime,
                conversationId: context.conversationId,
              });
            }
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

            await this.saveLog(agent, context, { text: finalResponse }, clientIp, uid, ReasoningMode.NONE, startTime);
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

  private async executeReActStream(
    agent: any,
    context: any,
    reasoningMode: ReasoningMode,
    startTime: number,
    clientIp: string,
    uid: string | undefined,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const messages: ModelMessage[] = [];
    let currentPrompt = context.userMessage;
    let finalResponse = '';
    const steps: any[] = [];

    const tools = AiSdkToolAdapter.toAisSdkTools(context.tools);

    try {
      await this.conversationService.addMessage(
        context.conversationId,
        'user',
        context.userMessage,
      );

      for (let i = 0; i < context.maxSteps; i++) {
        this.logger.debug(`ReAct Stream Step ${i + 1}`);

        const stepMessages: ModelMessage[] = [
          { role: 'system', content: context.systemPrompt },
          ...context.conversationHistory,
          ...messages,
          { role: 'user', content: currentPrompt },
        ];

        let stepText = '';
        let hasFinalAnswer = false;
        let toolCallDetected: { name: string; args: any } | null = null;
        let inAnswerMode = false;
        let answerBuffer = '';

        await this.aiSdkProvider.streamText({
          model: context.model,
          messages: stepMessages,
          tools,
          temperature: context.temperature,
          clientIp,
          userAgent: 'agent-service',
          uid,
          onChunk: (chunk) => {
            stepText += chunk;
            
            if (inAnswerMode) {
              answerBuffer += chunk;
              callbacks.onChunk?.(chunk);
              return;
            }
            
            if (stepText.includes('Final Answer:')) {
              inAnswerMode = true;
              const parts = stepText.split('Final Answer:');
              if (parts[1]) {
                answerBuffer = parts[1];
                callbacks.onChunk?.(parts[1]);
              }
              return;
            }
            
            if (stepText.includes('Action: 无需') || stepText.includes('Action: 无')) {
              inAnswerMode = true;
              const actionMatch = stepText.match(/Action:\s*无需[^。]*[。:：]?\s*(.+?)(?:\n|$)/);
              if (actionMatch && actionMatch[1]) {
                answerBuffer = actionMatch[1];
                callbacks.onChunk?.(actionMatch[1]);
              }
              return;
            }
          },
          onToolCall: (toolCall) => {
            this.logger.debug(`onToolCall received: ${JSON.stringify(toolCall)}`);
            toolCallDetected = toolCall;
          },
        });

        if (stepText.includes('Final Answer:')) {
          hasFinalAnswer = true;
          const thoughtPart = stepText.split('Final Answer:')[0];
          
          if (thoughtPart.trim()) {
            steps.push({
              stepNumber: i + 1,
              stepType: 'thought',
              content: thoughtPart.trim(),
            });
            callbacks.onStep?.({
              stepNumber: i + 1,
              stepType: 'thought',
              content: thoughtPart.trim(),
            });
          }
          
          const finalAnswerPart = stepText.substring(stepText.indexOf('Final Answer:') + 13).trim();
          finalResponse = finalAnswerPart;

          steps.push({
            stepNumber: steps.length > 0 ? steps.length + 1 : i + 1,
            stepType: 'final_answer',
            content: finalAnswerPart,
          });

          break;
        }

        if (stepText.trim() && !stepText.includes('Thought:') && !stepText.includes('Action:')) {
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'thought',
            content: stepText.trim(),
          });
        }

        if (toolCallDetected && typeof toolCallDetected === 'object') {
          const tc = toolCallDetected as { name: string; args: any };
          try {
            const actionStep = {
              stepNumber: steps.length + 1,
              stepType: 'action' as const,
              content: stepText.trim() || `需要调用工具 ${tc.name} 获取相关信息`,
              toolName: tc.name,
              toolArgs: tc.args,
            };
            steps.push(actionStep);
            callbacks.onStep?.(actionStep);

            const toolResult = await this.executeTool(tc.name, tc.args, context);

            callbacks.onToolCall?.({
              name: tc.name,
              args: tc.args,
              result: toolResult,
            });

            const resultText = typeof toolResult === 'object' ? JSON.stringify(toolResult, null, 2) : String(toolResult);
            messages.push({ role: 'assistant', content: stepText });
            currentPrompt = `工具 ${tc.name} 返回结果:\n${resultText}\n\n请基于以上结果继续回答用户问题。如果已经得到答案，使用 Final Answer 输出最终答案。`;

            const observationStep = {
              stepNumber: steps.length + 1,
              stepType: 'observation' as const,
              content: resultText,
              toolName: tc.name,
              toolOutput: toolResult,
            };
            steps.push(observationStep);
            callbacks.onStep?.(observationStep);

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
            
            const actionStep = {
              stepNumber: steps.length + 1,
              stepType: 'action' as const,
              content: stepText.trim() || `调用工具: ${tc.name}`,
              toolName: tc.name,
              toolArgs: tc.args,
            };
            steps.push(actionStep);
            callbacks.onStep?.(actionStep);

            const observationStep = {
              stepNumber: steps.length + 1,
              stepType: 'observation' as const,
              content: `错误: ${errorMsg}`,
              toolName: tc.name,
              toolOutput: null,
            };
            steps.push(observationStep);
            callbacks.onStep?.(observationStep);

            currentPrompt = `工具执行失败: ${errorMsg}\n请尝试其他方式回答用户的问题。`;
          }
        } else if (!stepText.includes('Thought:') && !stepText.includes('Action:')) {
          finalResponse = stepText.trim();
          if (steps.length > 0 && steps[steps.length - 1].observation) {
            steps[steps.length - 1].finalAnswer = finalResponse;
          }
          steps.push({
            stepNumber: steps.length + 1,
            stepType: 'final_answer',
            content: finalResponse,
          });
          callbacks.onStep?.({
            stepNumber: steps.length,
            stepType: 'final_answer',
            content: finalResponse,
          });
          break;
        } else {
          if (stepText.includes('已经得到答案') || stepText.includes('现在的时间') || stepText.includes('答案是') || stepText.includes('无需执行任何工具')) {
            const answerText = this.extractFinalAnswer(stepText);
            finalResponse = answerText;
            steps.push({
              stepNumber: steps.length + 1,
              stepType: 'final_answer',
              content: finalResponse,
            });
            callbacks.onStep?.({
              stepNumber: steps.length,
              stepType: 'final_answer',
              content: finalResponse,
            });
            break;
          }
          const thoughtStep = {
            stepNumber: steps.length + 1,
            stepType: 'thought' as const,
            content: this.extractFinalAnswer(stepText),
          };
          steps.push(thoughtStep);
          callbacks.onStep?.(thoughtStep);
          
          messages.push({ role: 'assistant', content: stepText });
          currentPrompt = `请继续思考并回答用户问题。如果已经得到答案，使用 Final Answer 输出最终答案。`;
        }
      }

      if (!finalResponse) {
        finalResponse = '抱歉，我无法在有限的步骤内完成您的请求。';
      }

      await this.conversationService.addMessage(
        context.conversationId,
        'assistant',
        finalResponse,
        { reasoningSteps: steps },
      );

      if (context.conversationHistory.length === 0) {
        await this.conversationService.generateTitle(context.conversationId);
      }

      await this.saveLog(agent, context, { text: finalResponse, steps }, clientIp, uid, reasoningMode, startTime);

      callbacks.onDone?.({
        success: true,
        response: finalResponse,
        steps,
        totalCostMs: Date.now() - startTime,
        conversationId: context.conversationId,
      });
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private parseToolCallFromText(text: string): { toolCalls: Array<{ name: string; args: Record<string, unknown> }> } {
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    try {
      // 尝试解析 JSON 格式的工具调用
      const jsonMatch = text.match(/\{[\s\S]*"Action[\s\S]*":[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.Action && parsed['Action Input']) {
          toolCalls.push({
            name: parsed.Action,
            args: typeof parsed['Action Input'] === 'string' ? JSON.parse(parsed['Action Input']) : parsed['Action Input'],
          });
        }
      } else {
        // 尝试解析文本格式的工具调用（GLM4等模型使用这种格式）
        const actionMatch = text.match(/Action:\s*(\S+)/);
        const actionInputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\})/);
        
        if (actionMatch && actionInputMatch) {
          const toolName = actionMatch[1].trim();
          try {
            const toolArgs = JSON.parse(actionInputMatch[1].trim());
            toolCalls.push({
              name: toolName,
              args: toolArgs,
            });
          } catch (e) {
            this.logger.warn('Failed to parse Action Input JSON');
          }
        }
      }
    } catch (e) {
      this.logger.warn('Failed to parse tool call from text');
    }

    return { toolCalls };
  }

  private extractFinalAnswer(text: string): string {
    const content = text.trim();
    
    // 如果包含 "无需执行任何工具" 且之后只有很少内容（用户。），这可能是中间步骤，不是最终答案
    if (content.includes('无需执行任何工具')) {
      const afterAction = content.split('无需执行任何工具').pop()?.trim() || '';
      // 如果 Action: 之后的内容很短（少于10个字符），可能是中间思考，不是答案
      if (afterAction.length < 10) {
        // 返回空白，表示这不是有效的最终答案
        return '';
      }
      return afterAction;
    }
    
    // 方法1：如果包含 "当前时间是" 或类似格式，直接提取答案
    const timeMatch = content.match(/(当前时间是|现在的时间是)([^]。]+。?)/);
    if (timeMatch) {
      return (timeMatch[1] + timeMatch[2]).trim() + '。';
    }
    
    // 方法2：如果包含 "答案是" 或类似格式，提取答案
    const answerMatch = content.match(/(答案是)([^]。「.+?」?)。?/);
    if (answerMatch) {
      return (answerMatch[1] + answerMatch[2]).trim() + '。';
    }
    
    // 方法3：如果有 Final Answer: 标记，提取其后的内容
    if (content.includes('Final Answer:')) {
      return content.split('Final Answer:').pop()?.trim() || content;
    }
    
    // 方法5：移除 Thought: 和 Action: 标记，保留剩余内容
    let cleaned = content
      .replace(/Thought:\s*[\s\S]*?(?=Action:)/g, '')
      .replace(/Action:\s*[^当][^。]*/g, '')
      .replace(/Observation:\s*\{[\s\S]*?\}\s*/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    
    return cleaned || content;
  }

  private async executeTool(name: string, args: Record<string, unknown>, context: any): Promise<unknown> {
    this.logger.log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);

    if (name.startsWith('mcp:')) {
      const parts = name.split(':');
      const serverName = parts[1];
      const toolName = parts.slice(2).join(':');

      const mcpServers = JSON.parse(context.agent.mcpServers || '[]');
      const serverConfig = mcpServers.find((s: any) => s.name === serverName);

      if (serverConfig) {
        return this.mcpServerService.callTool([serverConfig], toolName, args);
      }
      throw new Error(`MCP server not found: ${serverName}`);
    }

    if (name === 'kb_search') {
      const kbCodes = JSON.parse(context.agent.knowledgeBases || '[]');
      return this.kbSearchTool.execute(context.agent.id, kbCodes, args as { query: string; kb_codes?: string[]; top_k?: number; similarity_threshold?: number });
    }

    return this.skillService.execute({
      skillCode: name,
      params: args,
    });
  }

  private async saveLog(
    agent: any,
    context: any,
    result: any,
    clientIp: string,
    uid: string | undefined,
    reasoningMode: ReasoningMode,
    startTime: number,
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
        },
      });
    } catch (e) {
      this.logger.error('Failed to save log:', e);
    }
  }
}
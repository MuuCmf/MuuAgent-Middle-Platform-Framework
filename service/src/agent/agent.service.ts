import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsolationService, IsolationContext } from '../common/services/base-isolated.service';
import { ContextBuilder } from './execution/context-builder';
import { ReasoningEngineFactory } from '../reasoning/reasoning.factory';
import { ReasoningMode } from '../reasoning/types';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentChatDto,
  QueryAgentDto,
} from './dto/agent.dto';
import { StreamEmitter, StreamEventType, StreamEvents } from '../stream';
import { ClientToolPolicyService } from '../client-tool';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private isolationService: IsolationService,
    private contextBuilder: ContextBuilder,
    private reasoningEngineFactory: ReasoningEngineFactory,
    private clientToolPolicyService: ClientToolPolicyService,
  ) {}

  /**
   * 创建智能体
   * @param dto 创建智能体DTO
   * @param context 
   * @returns 
   */
  async create(dto: CreateAgentDto, context?: IsolationContext) {
    const data = this.isolationService.buildCreateData({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      skills: dto.skills || '[]',
      mcpServers: dto.mcpServers || '[]',
      maxSteps: dto.maxSteps ?? 5,
      status: dto.status ?? true,
      modelTemplateCode: dto.modelTemplateCode,
      customModelParams: dto.customModelParams,
      reasoningMode: dto.reasoningMode || 'NONE',
      reasoningPrompt: dto.reasoningPrompt,
      kbRetrievalConfig: dto.kbRetrievalConfig || JSON.stringify({ strategy: 'TOOL' }),
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    return this.prisma.agent.create({ data });
  }

  async update(id: string, dto: UpdateAgentDto, context?: IsolationContext) {
    const where = this.isolationService.buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    const updateData: any = { ...dto };

    return this.prisma.agent.update({
      where: { id: id as any },
      data: updateData,
    });
  }

  async remove(id: string, context?: IsolationContext): Promise<void> {
    const where = this.isolationService.buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({ where });
    if (!agent) {
      throw new NotFoundException('智能体不存在或无权限操作');
    }

    await this.prisma.agent.delete({ where: { id: id as any } });
  }

  async findOne(id: string, context?: IsolationContext) {
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const agent = await this.prisma.agent.findFirst({
      where: { id, ...isolationWhere },
    });
    if (!agent) {
      throw new NotFoundException('智能体不存在');
    }
    return agent;
  }

  async findByCode(code: string, context?: IsolationContext) {
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
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

    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
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

  async syncChat(dto: AgentChatDto, clientIp: string, uid?: string, appCode?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    const context = await this.contextBuilder.build(dto, agent, uid, isolationContext);
    context.clientIp = clientIp;
    context.appCode = appCode;
    context.startTime = startTime;

    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;
    const engine = this.reasoningEngineFactory.getEngine(reasoningMode);
    const result = await engine.executeSync(context);

    return {
      response: result.response,
      toolCalls: result.toolCalls,
      steps: result.steps,
      reasoningMode: reasoningMode,
      conversationId: context.conversationId,
    };
  }

  async streamChatWithEmitter(
    dto: AgentChatDto,
    clientIp: string,
    uid: string | undefined,
    emitter: StreamEmitter,
    appCode?: string,
  ): Promise<void> {
    this.logger.log(`[AgentStream] streamChat 开始, agentId: ${dto.agentId}`);
    const startTime = Date.now();
    const isolationContext: IsolationContext = { appCode: appCode || null, isSuperAdmin: false };
    const agent = await this.getAgent(dto.agentId, isolationContext);
    this.logger.log(`[AgentStream] 获取到智能体, id: ${agent.id}`);

    const context = await this.contextBuilder.build(dto, agent, uid, isolationContext);
    context.clientIp = clientIp;
    context.appCode = appCode;
    context.startTime = startTime;

    if (context.conversationId) {
      emitter.emit({ type: StreamEventType.CONVERSATION_ID, payload: { conversationId: context.conversationId } });
    }

    const policies = this.clientToolPolicyService.getAllPolicies();
    if (policies.length > 0) {
      emitter.emit(StreamEvents.clientToolPolicy(
        policies.map(p => ({
          moduleName: p.moduleName,
          defaultConfirmMode: p.defaultConfirmMode,
          defaultTimeout: p.defaultTimeout,
          tools: p.tools.map(t => ({
            toolName: t.toolName,
            confirmMode: t.confirmMode,
            confirmMessage: t.confirmMessage,
            timeout: t.timeout,
          })),
        })),
      ));
    }

    const reasoningMode = (agent.reasoningMode as ReasoningMode) || ReasoningMode.NONE;
    this.logger.log(`[AgentStream] reasoningMode: ${reasoningMode}`);

    const engine = this.reasoningEngineFactory.getEngine(reasoningMode);
    await engine.executeStream(context, emitter);
  }

  private async getAgent(agentId: string, context?: IsolationContext) {
    this.logger.log(`[AgentStream] 获取智能体: ${agentId}`);
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });

    const where = {
      AND: [
        { OR: [{ id: agentId }, { code: agentId }] },
        isolationWhere,
      ],
    };

    let agent;
    try {
      agent = await this.prisma.agent.findFirst({ where });
      //this.logger.log(`[AgentStream] 查询结果: ${JSON.stringify(agent)}`);
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
}
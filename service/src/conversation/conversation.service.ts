import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateConversationDto, ConversationType } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { IsolationContext, buildIsolationWhere, buildCreateData, buildOwnerWhere } from '../common/utils/isolation.util';

/**
 * 会话服务
 * 管理会话和消息的CRUD操作，支持多种对话类型
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 创建新会话
   * @param dto 创建参数
   * @param context 隔离上下文
   * @returns 创建的会话
   */
  async create(dto: CreateConversationDto, context?: IsolationContext) {
    const conversationType = dto.conversationType || ConversationType.AGENT;

    const data = buildCreateData({
      conversationType,
      targetId: dto.targetId,
      title: dto.title,
      uid: dto.uid,
      status: 'active',
    }, context || { appCode: null, isSuperAdmin: false });

    const conversation = await this.prisma.conversation.create({ data });

    this.logger.log(
      `创建会话: ${conversation.id}, type: ${conversationType}, targetId: ${dto.targetId}, appCode: ${conversation.appCode}`,
    );
    return conversation;
  }

  /**
   * 获取或创建会话
   * 如果提供了conversationId则返回现有会话，否则创建新会话
   * @param conversationType 会话类型
   * @param targetId 目标ID
   * @param conversationId 会话ID（可选）
   * @param uid 用户ID（可选）
   * @param context 隔离上下文
   * @returns 会话信息
   */
  async getOrCreate(
    conversationType: ConversationType,
    targetId: string,
    conversationId?: string,
    uid?: string,
    context?: IsolationContext,
  ) {
    this.logger.log(`getOrCreate: conversationType=${conversationType}, targetId=${targetId}, conversationId=${conversationId}, uid=${uid}`);

    if (conversationId) {
      const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false }, 'appCode', 'isPublic', false);
      const existing = await this.prisma.conversation.findFirst({
        where: { id: conversationId, ...isolationWhere },
      });

      if (existing) {
        this.logger.log(`getOrCreate: found existing conversation id=${existing.id}, targetId=${existing.targetId}, type=${existing.conversationType}`);
        if (
          existing.conversationType !== conversationType ||
          existing.targetId !== targetId
        ) {
          throw new BadRequestException('会话类型或目标不匹配');
        }

        if (uid && existing.uid && existing.uid !== uid) {
          throw new NotFoundException('会话不存在');
        }
        return existing;
      }
      this.logger.log(`getOrCreate: conversationId=${conversationId} not found, creating new`);
    }

    return this.create({
      conversationType,
      targetId,
      uid,
    }, context);
  }

  /**
   * 更新会话
   * @param id 会话ID
   * @param dto 更新参数
   * @param context 隔离上下文
   * @returns 更新后的会话
   */
  async update(id: string, dto: UpdateConversationDto, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const conversation = await this.prisma.conversation.findFirst({
      where: { ...where },
    });

    if (!conversation) {
      throw new NotFoundException('会话不存在或无权限操作');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除会话（软删除）
   * @param id 会话ID
   * @param context 隔离上下文
   */
  async remove(id: string, context?: IsolationContext) {
    const where = buildOwnerWhere(id, context || { appCode: null, isSuperAdmin: false });
    const conversation = await this.prisma.conversation.findFirst({
      where: { ...where },
    });

    if (!conversation) {
      throw new NotFoundException('会话不存在或无权限操作');
    }

    await this.prisma.conversation.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }

  /**
   * 获取会话详情
   * @param id 会话ID
   * @param messageLimit 消息数量限制
   * @param context 隔离上下文
   * @returns 会话详情（包含消息）
   */
  async findOne(id: string, messageLimit?: number, context?: IsolationContext) {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false }, 'appCode', 'isPublic', false);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, ...isolationWhere },
    });

    if (!conversation) {
      throw new NotFoundException('会话不存在');
    }

    let targetInfo: any = null;
    if (conversation.conversationType === ConversationType.AGENT) {
      const agent = await this.prisma.agent.findUnique({
        where: { id: conversation.targetId },
        select: { id: true, name: true, code: true },
      });
      targetInfo = { type: 'agent', ...agent };
    } else if (conversation.conversationType === ConversationType.KB_RAG) {
      const kb = await this.prisma.kbInfo.findUnique({
        where: { id: conversation.targetId },
        select: { id: true, kbName: true, kbCode: true },
      });
      targetInfo = { type: 'kb', ...kb };
    } else if (conversation.conversationType === ConversationType.MODEL) {
      targetInfo = { type: 'model', modelCode: conversation.targetId };
    }

    const messages = await this.getMessages(id, messageLimit || 50);

    return {
      conversation: {
        ...conversation,
        targetInfo,
      },
      messages,
    };
  }

  /**
   * 分页查询会话列表
   * @param query 查询参数
   * @param context 隔离上下文
   * @returns 会话列表
   */
  async findAll(query: QueryConversationDto, context?: IsolationContext) {
    const { conversationType, targetId, uid, status, keyword, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false }, 'appCode', 'isPublic', false);
    const where: any = { ...isolationWhere };

    if (conversationType) where.conversationType = conversationType;
    if (targetId) where.targetId = targetId;
    if (uid) where.uid = uid;
    if (status) where.status = status;
    if (keyword) {
      where.title = { contains: keyword };
    }

    const [list, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              content: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const enrichedList = await Promise.all(
      list.map(async (c) => {
        let targetInfo: any = null;

        if (c.conversationType === ConversationType.AGENT) {
          const agent = await this.prisma.agent.findUnique({
            where: { id: c.targetId },
            select: { id: true, name: true, code: true },
          });
          targetInfo = agent;
        } else if (c.conversationType === ConversationType.KB_RAG) {
          const kb = await this.prisma.kbInfo.findUnique({
            where: { id: c.targetId },
            select: { id: true, kbName: true, kbCode: true },
          });
          targetInfo = kb;
        } else if (c.conversationType === ConversationType.MODEL) {
          targetInfo = { modelCode: c.targetId };
        }

        return {
          ...c,
          targetInfo,
          lastMessage: c.messages[0]?.content?.substring(0, 100),
        };
      }),
    );

    return {
      list: enrichedList,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取会话消息列表
   * @param conversationId 会话ID
   * @param limit 消息数量限制
   * @returns 消息列表
   */
  async getMessages(conversationId: string, limit: number = 50) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map((m) => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      reasoningSteps: m.reasoningSteps ? JSON.parse(m.reasoningSteps) : null,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
    }));
  }

  /**
   * 添加消息到会话
   * @param conversationId 会话ID
   * @param role 角色
   * @param content 内容
   * @param options 额外选项
   * @returns 创建的消息
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    options?: {
      toolCalls?: any;
      toolCallId?: string;
      tokenCount?: number;
      reasoningSteps?: any;
      metadata?: any;
    },
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        toolCalls: options?.toolCalls ? JSON.stringify(options.toolCalls) : null,
        toolCallId: options?.toolCallId,
        tokenCount: options?.tokenCount,
        reasoningSteps: options?.reasoningSteps ? JSON.stringify(options.reasoningSteps) : null,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    return message;
  }

  /**
   * 构建对话上下文
   * 用于LLM调用的消息格式
   * @param conversationId 会话ID
   * @param limit 历史消息数量限制
   * @returns 消息数组
   */
  async buildContext(
    conversationId: string,
    limit: number = 20,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.getMessages(conversationId, limit);

    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * 清空会话消息
   * @param conversationId 会话ID
   */
  async clearMessages(conversationId: string) {
    await this.prisma.message.deleteMany({
      where: { conversationId },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: 0,
        lastMessageAt: new Date(),
      },
    });
  }

  /**
   * 自动生成会话标题
   * 基于第一条用户消息
   * @param conversationId 会话ID
   */
  async generateTitle(conversationId: string) {
    const firstMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        role: 'user',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (firstMessage) {
      const title = firstMessage.content.substring(0, 50);
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { UpdateKbDto } from './dto/update-kb.dto';
import { QueryKbListDto } from './dto/query-kb-list.dto';
import { DeleteKbDto } from './dto/delete-kb.dto';
import { IsolationContext, buildIsolationWhere, buildCreateData, buildOwnerWhere } from '../common/utils/isolation.util';

/**
 * 知识库管理服务
 */
@Injectable()
export class KbService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建知识库
   * @param dto 创建参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 创建结果
   */
  async create(dto: CreateKbDto, context?: IsolationContext): Promise<any> {
    const retrievalMethod = dto.retrievalMethod || 'vector';
    const embeddingModel = dto.embeddingModel || 'doubao-embedding-v1';
    
    if (retrievalMethod === 'vector') {
      const model = await this.prisma.model.findFirst({
        where: { 
          code: embeddingModel, 
          status: true 
        }
      });

      if (!model) {
        throw new BadRequestException('选择的向量模型不存在或未启用');
      }
    }

    const data = buildCreateData({
      kbName: dto.kbName,
      kbCode: dto.kbCode,
      embeddingModel: embeddingModel,
      chunkSize: dto.chunkSize || 500,
      chunkOverlap: dto.chunkOverlap || 100,
      similarityThresh: dto.similarityThresh || 0.7,
      topN: dto.topN || 5,
      retrievalMethod: retrievalMethod,
      description: dto.description,
      createdBy: dto.uid,
      appCode: dto.appCode,
      isPublic: dto.isPublic ?? false,
    }, context || { appCode: null, isSuperAdmin: false });

    const kb = await this.prisma.kbInfo.create({ data });

    return {
      kbId: kb.id,
      kbName: kb.kbName,
      kbCode: kb.kbCode,
      status: kb.status,
      createdTime: kb.createdAt,
    };
  }

  /**
   * 查询知识库列表
   * @param dto 查询参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 查询结果
   */
  async findAll(dto: QueryKbListDto, context?: IsolationContext): Promise<any> {
    const pageNum = dto.pageNum || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (pageNum - 1) * pageSize;

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const where: any = {
      isDeleted: false,
      ...isolationWhere,
    };

    if (dto.keyword) {
      const keywordOr = [
        { kbName: { contains: dto.keyword } },
        { kbCode: { contains: dto.keyword } },
      ];
      // 保留隔离条件的 OR，避免被 keyword 的 OR 覆盖
      if (isolationWhere.OR) {
        where.OR = isolationWhere.OR.map((cond: any) => ({
          ...cond,
          OR: keywordOr,
        }));
      } else {
        where.OR = keywordOr;
      }
    }

    if (dto.status !== undefined) {
      where.status = dto.status === 'true';
    }

    const [total, list] = await Promise.all([
      this.prisma.kbInfo.count({ where }),
      this.prisma.kbInfo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kbName: true,
          kbCode: true,
          embeddingModel: true,
          chunkSize: true,
          chunkOverlap: true,
          similarityThresh: true,
          topN: true,
          retrievalMethod: true,
          status: true,
          isPublic: true,
          description: true,
          createdAt: true,
          createdBy: true,
          appCode: true,
          _count: {
            select: {
              documents: { where: { isDeleted: false } },
              chunks: { where: { isDeleted: false } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      list: list.map((item) => ({
        kbId: item.id,
        kbName: item.kbName,
        kbCode: item.kbCode,
        embeddingModel: item.embeddingModel,
        chunkSize: item.chunkSize,
        chunkOverlap: item.chunkOverlap,
        similarityThresh: item.similarityThresh,
        topN: item.topN,
        retrievalMethod: item.retrievalMethod,
        status: item.status,
        isPublic: item.isPublic,
        description: item.description,
        createdTime: item.createdAt,
        createdBy: item.createdBy,
        appCode: item.appCode,
        documentCount: item._count.documents,
        chunkCount: item._count.chunks,
      })),
      pageNum,
      pageSize,
    };
  }

  /**
   * 查询知识库详情
   * @param kbId 知识库ID
   * @param context 隔离上下文
   * @returns {Promise<any>} 知识库详情
   */
  async findOne(kbId: string, context?: IsolationContext): Promise<any> {
    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: kbId, isDeleted: false, ...isolationWhere },
      include: {
        _count: {
          select: {
            documents: { where: { isDeleted: false } },
            chunks: { where: { isDeleted: false } },
          },
        },
      },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    return {
      kbId: kb.id,
      kbName: kb.kbName,
      kbCode: kb.kbCode,
      embeddingModel: kb.embeddingModel,
      chunkSize: kb.chunkSize,
      chunkOverlap: kb.chunkOverlap,
      similarityThresh: kb.similarityThresh,
      topN: kb.topN,
      retrievalMethod: kb.retrievalMethod,
      status: kb.status,
      isPublic: kb.isPublic,
      description: kb.description,
      createdTime: kb.createdAt,
      updatedTime: kb.updatedAt,
      createdBy: kb.createdBy,
      updatedBy: kb.updatedBy,
      appCode: kb.appCode,
      documentCount: kb._count.documents,
      chunkCount: kb._count.chunks,
    };
  }

  /**
   * 更新知识库
   * @param dto 更新参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 更新结果
   */
  async update(dto: UpdateKbDto, context?: IsolationContext): Promise<any> {
    const where = buildOwnerWhere(dto.kbId, context || { appCode: null, isSuperAdmin: false });
    const kb = await this.prisma.kbInfo.findFirst({
      where: { ...where, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或无权限操作');
    }

    const retrievalMethod = dto.retrievalMethod || kb.retrievalMethod || 'vector';

    if (dto.embeddingModel && retrievalMethod === 'vector') {
      const model = await this.prisma.model.findFirst({
        where: { 
          code: dto.embeddingModel, 
          status: true 
        }
      });

      if (!model) {
        throw new BadRequestException('选择的向量模型不存在或未启用');
      }
    }

    const updateData: any = {
      updatedBy: dto.uid,
    };

    if (dto.kbName) updateData.kbName = dto.kbName;
    if (dto.embeddingModel) updateData.embeddingModel = dto.embeddingModel;
    if (dto.chunkSize) updateData.chunkSize = dto.chunkSize;
    if (dto.chunkOverlap) updateData.chunkOverlap = dto.chunkOverlap;
    if (dto.similarityThresh !== undefined) updateData.similarityThresh = dto.similarityThresh;
    if (dto.topN) updateData.topN = dto.topN;
    if (dto.description) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.retrievalMethod) updateData.retrievalMethod = dto.retrievalMethod;

    await this.prisma.kbInfo.update({
      where: { id: dto.kbId as any },
      data: updateData,
    });

    return true;
  }

  /**
   * 删除知识库（软删除）
   * @param dto 删除参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 删除结果
   */
  async delete(dto: DeleteKbDto, context?: IsolationContext): Promise<any> {
    const where = buildOwnerWhere(dto.kbId, context || { appCode: null, isSuperAdmin: false });
    const kb = await this.prisma.kbInfo.findFirst({
      where: { ...where, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或无权限操作');
    }

    await this.prisma.kbInfo.update({
      where: { id: dto.kbId as any },
      data: {
        isDeleted: true,
        updatedBy: dto.uid,
      },
    });

    return true;
  }
}

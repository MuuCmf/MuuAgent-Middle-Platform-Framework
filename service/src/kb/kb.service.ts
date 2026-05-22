import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { UpdateKbDto } from './dto/update-kb.dto';
import { QueryKbListDto } from './dto/query-kb-list.dto';
import { DeleteKbDto } from './dto/delete-kb.dto';
import { IsolationService, IsolationContext } from '../common/services/base-isolated.service';
import { CacheService } from '../cache/cache.service';
import { RetrievalService } from '../retrieval/retrieval.service';

/**
 * 知识库管理服务
 */
@Injectable()
export class KbService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param isolationService 应用隔离服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly isolationService: IsolationService,
    private readonly cacheService: CacheService,
    private readonly retrievalService: RetrievalService,
  ) {}

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

    const data = this.isolationService.buildCreateData({
      kbName: dto.kbName,
      kbCode: dto.kbCode,
      embeddingModel: embeddingModel,
      chunkSize: dto.chunkSize || 500,
      chunkOverlap: dto.chunkOverlap || 100,
      similarityThresh: dto.similarityThresh || 0.5,
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

    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
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
    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
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
    const where = this.isolationService.buildOwnerWhere(dto.kbId, context || { appCode: null, isSuperAdmin: false });
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

    // 知识库配置变更（阈值、topN、检索方式等）后清除缓存
    this.cacheService.clearKbCache(dto.kbId).catch(err =>
      console.warn(`清除知识库 ${dto.kbId} 缓存失败:`, err),
    );

    // 异步预热：用历史高频查询 + 新配置回填缓存
    this.retrievalService.warmupKbCache(dto.kbId).catch(err =>
      console.warn(`预热知识库 ${dto.kbId} 缓存失败:`, err),
    );

    return true;
  }

  /**
   * 删除知识库（软删除）
   * @param dto 删除参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 删除结果
   */
  async delete(dto: DeleteKbDto, context?: IsolationContext): Promise<any> {
    const where = this.isolationService.buildOwnerWhere(dto.kbId, context || { appCode: null, isSuperAdmin: false });
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

    // 知识库删除后清除所有相关缓存
    this.cacheService.clearKbCache(dto.kbId).catch(err =>
      console.warn(`清除知识库 ${dto.kbId} 缓存失败:`, err),
    );

    // 异步预热：用历史高频查询回填缓存（基于删除后的文档集）
    this.retrievalService.warmupKbCache(dto.kbId).catch(err =>
      console.warn(`预热知识库 ${dto.kbId} 缓存失败:`, err),
    );

    return true;
  }
}

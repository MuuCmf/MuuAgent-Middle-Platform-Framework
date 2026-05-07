import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateKbDto } from './dto/create-kb.dto';
import { UpdateKbDto } from './dto/update-kb.dto';
import { QueryKbListDto } from './dto/query-kb-list.dto';
import { DeleteKbDto } from './dto/delete-kb.dto';

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
   * @returns {Promise<any>} 创建结果
   */
  async create(dto: CreateKbDto): Promise<any> {
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

    const kb = await this.prisma.kbInfo.create({
      data: {
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
      },
    });

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
   * @returns {Promise<any>} 查询结果
   */
  async findAll(dto: QueryKbListDto): Promise<any> {
    const pageNum = dto.pageNum || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (pageNum - 1) * pageSize;

    const where: any = {
      isDeleted: false,
    };

    if (dto.keyword) {
      where.OR = [
        { kbName: { contains: dto.keyword } },
        { kbCode: { contains: dto.keyword } },
      ];
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
   * @returns {Promise<any>} 知识库详情
   */
  async findOne(kbId: string): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: kbId, isDeleted: false },
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
      documentCount: kb._count.documents,
      chunkCount: kb._count.chunks,
    };
  }

  /**
   * 更新知识库
   * @param dto 更新参数
   * @returns {Promise<any>} 更新结果
   */
  async update(dto: UpdateKbDto): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
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
      where: { id: dto.kbId },
      data: updateData,
    });

    return true;
  }

  /**
   * 删除知识库（软删除）
   * @param dto 删除参数
   * @returns {Promise<any>} 删除结果
   */
  async delete(dto: DeleteKbDto): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    await this.prisma.kbInfo.update({
      where: { id: dto.kbId },
      data: {
        isDeleted: true,
        updatedBy: dto.uid,
      },
    });

    return true;
  }
}

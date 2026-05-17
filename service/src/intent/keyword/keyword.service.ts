import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateIntentKeywordDto,
  UpdateIntentKeywordDto,
  QueryIntentKeywordDto,
  BatchImportKeywordDto,
} from '../dto/intent-keyword.dto';

/**
 * 意图关键词管理服务
 * 提供关键词的CRUD操作和批量导入
 */
@Injectable()
export class IntentKeywordService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 创建关键词
   * @param dto 创建关键词DTO
   * @returns {Promise<Object>} 创建的关键词
   */
  async create(dto: CreateIntentKeywordDto) {
    return this.prisma.intentKeyword.create({
      data: {
        intent: dto.intent,
        keyword: dto.keyword,
        weight: dto.weight ?? 1,
        isRegex: dto.isRegex ?? false,
        status: dto.status ?? true,
        description: dto.description,
      },
    });
  }

  /**
   * 更新关键词
   * @param id 关键词ID
   * @param dto 更新关键词DTO
   * @returns {Promise<Object>} 更新后的关键词
   */
  async update(id: string, dto: UpdateIntentKeywordDto) {
    const keyword = await this.prisma.intentKeyword.findUnique({ where: { id: id as any } });
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    return this.prisma.intentKeyword.update({
      where: { id: id as any },
      data: dto,
    });
  }

  /**
   * 删除关键词
   * @param id 关键词ID
   * @returns {Promise<Object>} 删除的关键词
   */
  async remove(id: string) {
    const keyword = await this.prisma.intentKeyword.findUnique({ where: { id: id as any } });
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    return this.prisma.intentKeyword.delete({ where: { id: id as any } });
  }

  /**
   * 根据ID查询关键词
   * @param id 关键词ID
   * @returns {Promise<Object>} 关键词详情
   */
  async findOne(id: string) {
    const keyword = await this.prisma.intentKeyword.findUnique({ where: { id: id as any } });
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }
    return keyword;
  }

  /**
   * 分页查询关键词列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页关键词列表
   */
  async findAll(query: QueryIntentKeywordDto) {
    const { intent, status, keyword, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (intent) where.intent = intent;
    if (status !== undefined) where.status = status;
    if (keyword) {
      where.keyword = { contains: keyword };
    }

    const [list, total] = await Promise.all([
      this.prisma.intentKeyword.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ intent: 'asc' }, { weight: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.intentKeyword.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 批量导入关键词
   * @param dto 批量导入DTO
   * @returns {Promise<Object>} 导入结果
   */
  async batchImport(dto: BatchImportKeywordDto) {
    const { intent, keywords, weight = 1, isRegex = false } = dto;

    if (!keywords || keywords.length === 0) {
      throw new BadRequestException('关键词列表不能为空');
    }

    let created = 0;
    let skipped = 0;

    for (const kw of keywords) {
      const trimmed = kw.trim();
      if (!trimmed) continue;

      // 检查是否已存在相同的关键词
      const existing = await this.prisma.intentKeyword.findFirst({
        where: { intent, keyword: trimmed },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.intentKeyword.create({
        data: {
          intent,
          keyword: trimmed,
          weight,
          isRegex,
          status: true,
        },
      });
      created++;
    }

    return { created, skipped, total: keywords.length };
  }

  /**
   * 切换关键词启用状态
   * @param id 关键词ID
   * @param status 状态
   * @returns {Promise<Object>} 更新后的关键词
   */
  async toggleStatus(id: string, status: boolean) {
    const keyword = await this.prisma.intentKeyword.findUnique({ where: { id: id as any } });
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    return this.prisma.intentKeyword.update({
      where: { id: id as any },
      data: { status },
    });
  }

  /**
   * 获取所有启用的关键词（供意图分类服务使用）
   * @returns {Promise<Array>} 启用的关键词列表
   */
  async getEnabledKeywords() {
    return this.prisma.intentKeyword.findMany({
      where: { status: true },
      orderBy: [{ intent: 'asc' }, { weight: 'desc' }],
    });
  }

  /**
   * 按意图分组获取关键词统计
   * @returns {Promise<Array>} 各意图关键词数量统计
   */
  async getKeywordStats() {
    const keywords = await this.prisma.intentKeyword.findMany({
      where: { status: true },
    });

    const stats: Record<string, { total: number; regexCount: number }> = {};
    for (const kw of keywords) {
      if (!stats[kw.intent]) {
        stats[kw.intent] = { total: 0, regexCount: 0 };
      }
      stats[kw.intent].total++;
      if (kw.isRegex) {
        stats[kw.intent].regexCount++;
      }
    }

    return Object.entries(stats).map(([intent, data]) => ({
      intent,
      total: data.total,
      regexCount: data.regexCount,
    }));
  }
}
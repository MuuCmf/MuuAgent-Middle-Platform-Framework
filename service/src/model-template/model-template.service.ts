import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateModelTemplateDto,
  UpdateModelTemplateDto,
  QueryModelTemplateDto,
} from './dto/model-template.dto';

/**
 * 模型参数模板服务
 */
@Injectable()
export class ModelTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建模型参数模板
   * @param dto 创建DTO
   * @returns {Promise<any>} 创建的模板
   */
  async create(dto: CreateModelTemplateDto) {
    const existing = await this.prisma.modelTemplate.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('模板标识已存在');
    }

    if (dto.isDefault) {
      await this.prisma.modelTemplate.updateMany({
        where: {
          modelType: dto.modelType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.modelTemplate.create({
      data: {
        name: dto.name,
        code: dto.code,
        modelType: dto.modelType,
        temperature: dto.temperature ?? 0.7,
        topP: dto.topP ?? 0.7,
        contextWindow: dto.contextWindow ?? 8192,
        maxTokens: dto.maxTokens ?? 1000,
        sceneTag: dto.sceneTag,
        description: dto.description,
        remark: dto.remark,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? true,
      },
    });
  }

  /**
   * 更新模型参数模板
   * @param id 模板ID
   * @param dto 更新DTO
   * @returns {Promise<any>} 更新后的模板
   */
  async update(id: string, dto: UpdateModelTemplateDto) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { id: id as any },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    if (dto.code && dto.code !== template.code) {
      const existing = await this.prisma.modelTemplate.findUnique({
        where: { code: dto.code },
      });

      if (existing) {
        throw new ConflictException('模板标识已存在');
      }
    }

    if (dto.isDefault && !template.isDefault) {
      await this.prisma.modelTemplate.updateMany({
        where: {
          modelType: dto.modelType || template.modelType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.modelTemplate.update({
      where: { id: id as any },
      data: {
        name: dto.name,
        code: dto.code,
        modelType: dto.modelType,
        temperature: dto.temperature,
        topP: dto.topP,
        contextWindow: dto.contextWindow,
        maxTokens: dto.maxTokens,
        sceneTag: dto.sceneTag,
        description: dto.description,
        remark: dto.remark,
        isDefault: dto.isDefault,
        status: dto.status,
      },
    });
  }

  /**
   * 删除模型参数模板
   * @param id 模板ID
   * @returns {Promise<any>} 删除的模板
   */
  async delete(id: string) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { id: id as any },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return this.prisma.modelTemplate.delete({
      where: { id: id as any },
    });
  }

  /**
   * 获取模型参数模板详情
   * @param id 模板ID
   * @returns {Promise<any>} 模板详情
   */
  async findOne(id: string) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { id: id as any },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 根据标识获取模板
   * @param code 模板标识
   * @returns {Promise<any>} 模板详情
   */
  async findByCode(code: string) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { code },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 查询模型参数模板列表
   * @param query 查询DTO
   * @returns {Promise<{list: any[], total: number}>} 模板列表和总数
   */
  async findAll(query: QueryModelTemplateDto) {
    const { page = 1, pageSize = 10, modelType, sceneTag, status, isDefault } = query;

    const where: any = {};

    if (modelType) {
      where.modelType = modelType;
    }

    if (sceneTag) {
      where.sceneTag = sceneTag;
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (isDefault !== undefined) {
      where.isDefault = isDefault;
    }

    const [list, total] = await Promise.all([
      this.prisma.modelTemplate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.modelTemplate.count({ where }),
    ]);

    return { list, total };
  }

  /**
   * 获取指定模型类型的默认模板
   * @param modelType 模型类型
   * @returns {Promise<any>} 默认模板
   */
  async getDefaultTemplate(modelType: string) {
    const template = await this.prisma.modelTemplate.findFirst({
      where: {
        modelType,
        isDefault: true,
        status: true,
      },
    });

    return template;
  }

  /**
   * 复制模板
   * @param id 模板ID
   * @returns {Promise<any>} 复制的新模板
   */
  async copy(id: string) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { id: id as any },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    const newCode = `${template.code}-copy-${Date.now()}`;
    const newName = `${template.name} (副本)`;

    return this.prisma.modelTemplate.create({
      data: {
        name: newName,
        code: newCode,
        modelType: template.modelType,
        temperature: template.temperature,
        topP: template.topP,
        contextWindow: template.contextWindow,
        maxTokens: template.maxTokens,
        sceneTag: template.sceneTag,
        description: template.description,
        remark: template.remark,
        isDefault: false,
        status: true,
      },
    });
  }

  /**
   * 设置默认模板
   * @param id 模板ID
   * @returns {Promise<any>} 更新后的模板
   */
  async setDefault(id: string) {
    const template = await this.prisma.modelTemplate.findUnique({
      where: { id: id as any },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    await this.prisma.modelTemplate.updateMany({
      where: {
        modelType: template.modelType,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    return this.prisma.modelTemplate.update({
      where: { id: id as any },
      data: { isDefault: true },
    });
  }
}

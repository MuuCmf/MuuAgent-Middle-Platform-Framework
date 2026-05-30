import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateModelDto,
  UpdateModelDto,
  QueryModelDto,
} from './dto/model.dto';
import axios from 'axios';

/**
 * 模型管理服务
 * 提供模型的CRUD操作和健康检查
 */
@Injectable()
export class ModelService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 创建模型
   * @param dto 创建模型DTO
   * @returns {Promise<Object>} 创建的模型
   */
  async create(dto: CreateModelDto) {
    return this.prisma.model.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        provider: dto.provider,
        endpoint: dto.endpoint,
        apiKey: dto.apiKey,
        weight: dto.weight ?? 1,
        status: dto.status ?? true,
        description: dto.description,
        config: dto.config,
        tags: dto.tags,
        capabilities: dto.capabilities,
      },
    });
  }

  /**
   * 更新模型
   * @param id 模型ID
   * @param dto 更新模型DTO
   * @returns {Promise<Object>} 更新后的模型
   */
  async update(id: string, dto: UpdateModelDto) {
    const model = await this.prisma.model.findUnique({ where: { id: id as any } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    if (dto.code && dto.code !== model.code) {
      const existing = await this.prisma.model.findUnique({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException('模型标识已存在');
      }
    }

    const updateData: Record<string, unknown> = { ...dto };
    
    if (dto.apiKey !== undefined) {
      if (dto.apiKey === null) {
        updateData.apiKey = null;
      } else if (dto.apiKey === '') {
        delete updateData.apiKey;
      } else {
        updateData.apiKey = dto.apiKey;
      }
    }

    return this.prisma.model.update({
      where: { id: id as any },
      data: updateData,
    });
  }

  /**
   * 删除模型
   * @param id 模型ID
   * @returns {Promise<Object>} 删除的模型
   */
  async remove(id: string) {
    const model = await this.prisma.model.findUnique({ where: { id: id as any } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    const kbCount = await this.prisma.kbInfo.count({
      where: { 
        embeddingModel: model.code, 
        isDeleted: false 
      }
    });

    if (kbCount > 0) {
      throw new BadRequestException(
        `该模型正在被 ${kbCount} 个知识库使用，无法删除`
      );
    }

    return this.prisma.model.delete({ where: { id: id as any } });
  }

  /**
   * 根据ID查询模型
   * @param id 模型ID
   * @returns {Promise<Object>} 模型详情
   */
  async findOne(id: string) {
    const model = await this.prisma.model.findUnique({ where: { id: id as any } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }
    return model;
  }

  /**
   * 根据Code查询模型
   * @param code 模型标识码
   * @returns {Promise<Object>} 模型详情
   */
  async findByCode(code: string) {
    console.log('查找模型，code:', code);
    const model = await this.prisma.model.findUnique({ where: { code } });
    console.log('查询结果:', model);
    if (!model) {
      throw new NotFoundException(`模型不存在，请检查模型代码: ${code}`);
    }
    return model;
  }

  /**
   * 分页查询模型列表
   * @param query 查询参数
   * @returns {Promise<Object>} 分页模型列表
   */
  async findAll(query: QueryModelDto) {
    const { type, provider, status, tags, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (provider) where.provider = provider;
    if (status !== undefined) where.status = status;
    if (tags) where.tags = { contains: tags };

    const [list, total] = await Promise.all([
      this.prisma.model.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.model.count({ where }),
    ]);

    const modelsWithUsage = await Promise.all(
      list.map(async (model) => {
        const kbCount = await this.prisma.kbInfo.count({
          where: { 
            embeddingModel: model.code, 
            isDeleted: false 
          }
        });
        return {
          ...model,
          kbUsageCount: kbCount
        };
      })
    );

    return { list: modelsWithUsage, total, page, pageSize };
  }

  /**
   * 获取指定类型的可用模型列表
   * @param modelType 模型类型
   * @returns {Promise<Array>} 可用模型列表
   */
  async getAvailableModels(modelType: string) {
    return this.prisma.model.findMany({
      where: {
        type: modelType,
        status: true,
      },
      orderBy: { weight: 'desc' },
    });
  }

  /**
   * 模型健康检查
   * @param id 模型ID
   * @returns {Promise<Object>} 健康检查结果
   */
  async healthCheck(id: string) {
    const model = await this.prisma.model.findUnique({ where: { id: id as any } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    const startTime = Date.now();
    let status = 'healthy';
    let responseTime: number | null = null;
    let errorMessage: string | null = null;

    try {
      // 根据提供商类型进行不同的健康检查
      if (model.provider === 'ollama') {
        await axios.get(`${model.endpoint.replace('/api/chat', '/api/tags')}`, {
          timeout: 5000,
        });
      } else {
        // OpenAI兼容接口，发送简单请求
        await axios.get(`${model.endpoint.replace('/chat/completions', '/models')}`, {
          headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
          timeout: 5000,
        });
      }
      responseTime = Date.now() - startTime;
    } catch (error) {
      status = 'unhealthy';
      responseTime = Date.now() - startTime;
      errorMessage = error instanceof Error ? error.message : '未知错误';
    }

    // 记录健康检查结果
    await this.prisma.modelHealth.create({
      data: {
        modelId: model.id,
        status,
        responseTime,
        errorMessage,
      },
    });

    return {
      modelId: model.id,
      modelCode: model.code,
      status,
      responseTime,
      errorMessage,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 批量健康检查
   * @returns {Promise<Array>} 所有模型的健康检查结果
   */
  async healthCheckAll() {
    const models = await this.prisma.model.findMany({
      where: { status: true },
    });

    const results = [];
    for (const model of models) {
      try {
        const result = await this.healthCheck(model.id as any);
        results.push(result);
      } catch (error) {
        results.push({
          modelId: model.id,
          modelCode: model.code,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : '检查失败',
        });
      }
    }

    return results;
  }

  /**
   * 切换模型状态
   * @param id 模型ID
   * @param status 状态
   * @returns {Promise<Object>} 更新后的模型
   */
  async toggleStatus(id: string, status: boolean) {
    const model = await this.prisma.model.findUnique({ where: { id: id as any } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    return this.prisma.model.update({
      where: { id: id as any },
      data: { status },
    });
  }
}

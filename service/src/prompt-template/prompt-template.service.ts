import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
  QueryPromptTemplateDto,
  RenderPromptTemplateDto,
  RollbackPromptTemplateDto,
} from './dto/prompt-template.dto';

/**
 * Prompt 模板服务
 * 负责模板的 CRUD、渲染、版本管理等核心功能
 */
@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建模板
   * @param dto 创建 DTO
   * @returns 创建的模板
   */
  async create(dto: CreatePromptTemplateDto) {
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('模板标识已存在');
    }

    if (dto.isDefault) {
      await this.prisma.promptTemplate.updateMany({
        where: {
          category: dto.category,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const template = await this.prisma.promptTemplate.create({
      data: {
        name: dto.name,
        code: dto.code,
        category: dto.category,
        content: dto.content,
        variables: dto.variables ? JSON.stringify(dto.variables) : null,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? true,
        description: dto.description,
        tags: dto.tags ? JSON.stringify(dto.tags) : null,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        createdBy: dto.createdBy,
      },
    });

    await this.prisma.promptVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        content: template.content,
        variables: template.variables,
        changeLog: '初始版本',
        changeType: 'create',
        createdBy: dto.createdBy,
      },
    });

    this.logger.log(`创建模板成功: ${template.code}`);
    return template;
  }

  /**
   * 更新模板（创建新版本）
   * @param code 模板标识
   * @param dto 更新 DTO
   * @returns 更新后的模板
   */
  async update(code: string, dto: UpdatePromptTemplateDto) {
    const template = await this.prisma.promptTemplate.findFirst({
      where: { code },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    if (dto.isDefault) {
      await this.prisma.promptTemplate.updateMany({
        where: {
          category: template.category,
          isDefault: true,
          id: { not: template.id },
        },
        data: { isDefault: false },
      });
    }

    await this.prisma.$transaction([
      this.prisma.promptVersion.create({
        data: {
          templateId: template.id,
          version: template.version,
          content: template.content,
          variables: template.variables,
          changeLog: dto.changeLog || '版本更新',
          changeType: 'update',
          createdBy: dto.createdBy,
        },
      }),
      this.prisma.promptTemplate.update({
        where: { id: template.id },
        data: {
          name: dto.name,
          content: dto.content,
          variables: dto.variables ? JSON.stringify(dto.variables) : undefined,
          isDefault: dto.isDefault,
          status: dto.status,
          description: dto.description,
          tags: dto.tags ? JSON.stringify(dto.tags) : undefined,
          metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined,
          version: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`更新模板成功: ${code}, 新版本: ${template.version + 1}`);
    return this.prisma.promptTemplate.findUnique({ where: { id: template.id } });
  }

  /**
   * 删除模板
   * @param id 模板 ID
   */
  async delete(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    await this.prisma.promptTemplate.delete({
      where: { id },
    });

    this.logger.log(`删除模板成功: ${template.code}`);
  }

  /**
   * 查询单个模板
   * @param id 模板 ID
   * @returns 模板详情
   */
  async findOne(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 根据标识查询模板
   * @param code 模板标识
   * @returns 模板详情
   */
  async findByCode(code: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { code },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return template;
  }

  /**
   * 查询模板列表
   * @param query 查询条件
   * @returns 模板列表和总数
   */
  async findAll(query: QueryPromptTemplateDto) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.code) {
      where.code = { contains: query.code };
    }

    if (query.name) {
      where.name = { contains: query.name };
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.isDefault !== undefined) {
      where.isDefault = query.isDefault;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.tag) {
      where.tags = { contains: query.tag };
    }

    const [list, total] = await Promise.all([
      this.prisma.promptTemplate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promptTemplate.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 渲染模板
   * @param code 模板标识
   * @param variables 变量值
   * @returns 渲染后的 Prompt
   */
  async render(code: string, variables: Record<string, any>): Promise<string> {
    const startTime = Date.now();

    const template = await this.prisma.promptTemplate.findFirst({
      where: { code, status: true },
    });

    if (!template) {
      throw new NotFoundException('模板不存在或未启用');
    }

    const variableDefs = template.variables ? JSON.parse(template.variables) : [];
    const missingVariables = variableDefs
      .filter((v: any) => v.required && !variables.hasOwnProperty(v.name))
      .map((v: any) => v.name);

    if (missingVariables.length > 0) {
      throw new BadRequestException(`缺少必填变量: ${missingVariables.join(', ')}`);
    }

    let renderedPrompt = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    const costMs = Date.now() - startTime;
    this.logger.debug(`渲染模板成功: ${code}, 耗时: ${costMs}ms`);

    return renderedPrompt;
  }

  /**
   * 渲染模板并记录日志
   * @param dto 渲染 DTO
   * @param clientIp 客户端 IP
   * @param uid 用户 ID
   * @returns 渲染后的 Prompt
   */
  async renderWithLog(
    dto: RenderPromptTemplateDto,
    clientIp?: string,
    uid?: string,
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const renderedPrompt = await this.render(dto.code, dto.variables);

      const template = await this.prisma.promptTemplate.findFirst({
        where: { code: dto.code },
      });

      if (template) {
        await this.prisma.promptInvokeLog.create({
          data: {
            templateId: template.id,
            templateCode: dto.code,
            templateVersion: template.version,
            variables: JSON.stringify(dto.variables),
            renderedPrompt,
            success: true,
            costMs: Date.now() - startTime,
            clientIp,
            uid,
          },
        });
      }

      return renderedPrompt;
    } catch (error) {
      await this.prisma.promptInvokeLog.create({
        data: {
          templateCode: dto.code,
          templateVersion: 0,
          variables: JSON.stringify(dto.variables),
          renderedPrompt: '',
          success: false,
          errorMessage: error.message,
          costMs: Date.now() - startTime,
          clientIp,
          uid,
        },
      });

      throw error;
    }
  }

  /**
   * 获取版本历史
   * @param templateId 模板 ID
   * @param limit 限制数量
   * @returns 版本历史列表
   */
  async getVersionHistory(templateId: string, limit: number = 10) {
    return this.prisma.promptVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
      take: limit,
    });
  }

  /**
   * 版本回滚
   * @param id 模板 ID
   * @param version 目标版本号
   * @param dto 回滚 DTO
   * @returns 回滚后的模板
   */
  async rollback(id: string, version: number, dto?: RollbackPromptTemplateDto) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    const targetVersion = await this.prisma.promptVersion.findFirst({
      where: { templateId: id, version },
    });

    if (!targetVersion) {
      throw new NotFoundException('目标版本不存在');
    }

    await this.prisma.$transaction([
      this.prisma.promptVersion.create({
        data: {
          templateId: template.id,
          version: template.version,
          content: template.content,
          variables: template.variables,
          changeLog: dto?.changeLog || `回滚到版本 ${version}`,
          changeType: 'rollback',
          createdBy: dto?.createdBy,
        },
      }),
      this.prisma.promptTemplate.update({
        where: { id },
        data: {
          content: targetVersion.content,
          variables: targetVersion.variables,
          version: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`版本回滚成功: ${template.code}, 回滚到版本 ${version}`);
    return this.prisma.promptTemplate.findUnique({ where: { id } });
  }

  /**
   * 获取默认模板
   * @param category 分类
   * @returns 默认模板
   */
  async getDefaultTemplate(category: string) {
    const template = await this.prisma.promptTemplate.findFirst({
      where: {
        category,
        isDefault: true,
        status: true,
      },
    });

    return template;
  }

  /**
   * 设置默认模板
   * @param id 模板 ID
   * @returns 更新后的模板
   */
  async setDefault(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    await this.prisma.$transaction([
      this.prisma.promptTemplate.updateMany({
        where: {
          category: template.category,
          isDefault: true,
        },
        data: { isDefault: false },
      }),
      this.prisma.promptTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    this.logger.log(`设置默认模板成功: ${template.code}`);
    return this.prisma.promptTemplate.findUnique({ where: { id } });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppUsageService } from '../common/services/app-usage.service';
import { CreateAppDto, UpdateAppDto, QueryAppDto, ResetSecretDto } from './dto/app.dto';
import { randomUUID } from 'crypto';
import { SkillRegistry } from '../skill/skill-registry';
import { IsolationContext } from '../common/services/base-isolated.service';
import {
  TenantPermissions,
  parseTenantPermissions,
  DEFAULT_TENANT_PERMISSIONS,
} from '../common/constants/tenant-permission.constants';

/**
 * 应用管理服务
 * 
 * 提供应用的CRUD操作，包括：
 * - 创建应用
 * - 更新应用
 * - 删除应用
 * - 查询应用列表
 * - 查询应用详情
 * - 重置应用密钥
 * - 获取应用使用统计
 */
@Injectable()
export class AppService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(
    private prisma: PrismaService,
    private appUsageService: AppUsageService,
    private skillRegistry: SkillRegistry,
  ) {}

  /**
   * 创建应用
   * @param dto 创建DTO
   * @returns {Promise<object>} 创建结果
   */
  async create(dto: CreateAppDto) {
    const existing = await this.prisma.appTenant.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('应用标识已存在');
    }

    const apiKey = `ak_${randomUUID().replace(/-/g, '')}`;
    const secretKey = `sk_${randomUUID().replace(/-/g, '')}`;

    const app = await this.prisma.appTenant.create({
      data: {
        name: dto.name,
        code: dto.code,
        apiKey,
        secretKey,
        qpsLimit: dto.qpsLimit || 100,
        dailyLimit: dto.dailyLimit || 10000,
        tokenLimit: dto.tokenLimit || 1000000,
        enableOAuth: dto.enableOAuth || false,
        status: dto.status !== false,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
      },
    });

    return this.formatApp(app);
  }

  /**
   * 更新应用
   * @param id 应用ID
   * @param dto 更新DTO
   * @returns {Promise<object>} 更新结果
   */
  async update(id: string, dto: UpdateAppDto) {
    const existing = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!existing) {
      throw new NotFoundException('应用不存在');
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.appTenant.findUnique({
        where: { code: dto.code },
      });
      if (codeExists) {
        throw new BadRequestException('应用标识已存在');
      }
    }

    const app = await this.prisma.appTenant.update({
      where: { id: id as any },
      data: {
        name: dto.name,
        code: dto.code,
        qpsLimit: dto.qpsLimit,
        dailyLimit: dto.dailyLimit,
        tokenLimit: dto.tokenLimit,
        enableOAuth: dto.enableOAuth,
        status: dto.status,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : existing.expireAt,
      },
    });

    return this.formatApp(app);
  }

  /**
   * 删除应用
   * @param id 应用ID
   * @returns {Promise<void>}
   */
  async delete(id: string) {
    const existing = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!existing) {
      throw new NotFoundException('应用不存在');
    }

    await this.prisma.appTenant.delete({
      where: { id: id as any },
    });
  }

  /**
   * 查询应用列表
   * @param query 查询DTO
   * @returns {Promise<object>} 列表结果
   */
  async findAll(query: QueryAppDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { code: { contains: query.keyword } },
      ];
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [total, list] = await Promise.all([
      this.prisma.appTenant.count({ where }),
      this.prisma.appTenant.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      list: list.map((app) => this.formatApp(app)),
      total,
    };
  }

  /**
   * 查询应用详情
   * @param id 应用ID
   * @returns {Promise<object>} 应用详情
   */
  async findOne(id: string) {
    const app = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!app) {
      throw new NotFoundException('应用不存在');
    }

    return this.formatApp(app, true);
  }

  /**
   * 根据code查询应用详情
   * @param code 应用标识
   * @returns {Promise<object>} 应用详情
   */
  async findByCode(code: string) {
    const app = await this.prisma.appTenant.findUnique({
      where: { code },
    });

    if (!app) {
      throw new NotFoundException('应用不存在');
    }

    return this.formatApp(app, true);
  }

  /**
   * 重置应用密钥
   * @param id 应用ID
   * @param dto 重置DTO
   * @returns {Promise<object>} 新的密钥信息
   */
  async resetSecret(id: string, dto: ResetSecretDto) {
    const existing = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!existing) {
      throw new NotFoundException('应用不存在');
    }

    const secretKey = `sk_${randomUUID().replace(/-/g, '')}`;
    let apiKey = existing.apiKey;

    if (dto.resetApiKey) {
      apiKey = `ak_${randomUUID().replace(/-/g, '')}`;
    }

    const app = await this.prisma.appTenant.update({
      where: { id: id as any },
      data: {
        apiKey,
        secretKey,
      },
    });

    return {
      id: app.id,
      apiKey: app.apiKey,
      secretKey: app.secretKey,
    };
  }

  /**
   * 获取应用使用统计
   * @param id 应用ID
   * @returns {Promise<object>} 使用统计
   */
  async getUsage(id: string) {
    const app = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!app) {
      throw new NotFoundException('应用不存在');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      agentCount,
      skills,
      kbCount,
      todayUsage,
      monthUsage,
      todayTokens,
      monthTokens,
    ] = await Promise.all([
      this.prisma.agent.count({ where: { appCode: app.code } }),
      this.skillRegistry.listAll({ appCode: app.code } as IsolationContext),
      this.prisma.kbInfo.count({ where: { appCode: app.code } }),
      this.prisma.appUsage.findUnique({
        where: { appCode_date: { appCode: app.code, date: today } },
      }),
      this.appUsageService.getMonthlyUsage(app.code),
      this.appUsageService.getTokenUsageFromLogs(app.code, today),
      this.appUsageService.getTokenUsageFromLogs(app.code, new Date(today.getFullYear(), today.getMonth(), 1)),
    ]);

    return {
      agentCount,
      skillCount: skills.length,
      kbCount,
      todayCalls: todayUsage?.callCount || 0,
      todayTokens: todayTokens.inputTokens + todayTokens.outputTokens,
      todayInputTokens: todayTokens.inputTokens,
      todayOutputTokens: todayTokens.outputTokens,
      monthCalls: monthUsage.callCount,
      monthTokens: monthTokens.inputTokens + monthTokens.outputTokens,
      monthInputTokens: monthTokens.inputTokens,
      monthOutputTokens: monthTokens.outputTokens,
      dailyLimit: app.dailyLimit,
      tokenLimit: app.tokenLimit,
    };
  }

  /**
   * 获取租户权限配置
   * @param id 应用ID
   * @returns {Required<TenantPermissions>} 合并后的完整权限
   */
  async getPermissions(id: string): Promise<Required<TenantPermissions>> {
    const app = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!app) {
      throw new NotFoundException('应用不存在');
    }

    return parseTenantPermissions(app.permissions || '{}');
  }

  /**
   * 更新租户权限配置
   * @param id 应用ID
   * @param permissions 权限配置
   * @returns {Required<TenantPermissions>} 更新后的完整权限
   */
  async updatePermissions(id: string, permissions: TenantPermissions): Promise<Required<TenantPermissions>> {
    const existing = await this.prisma.appTenant.findUnique({
      where: { id: id as any },
    });

    if (!existing) {
      throw new NotFoundException('应用不存在');
    }

    await this.prisma.appTenant.update({
      where: { id: id as any },
      data: {
        permissions: JSON.stringify(permissions),
      },
    });

    return parseTenantPermissions(permissions);
  }

  /**
   * 格式化应用数据
   * @param app 应用数据
   * @param showSecret 是否显示密钥
   * @returns {object} 格式化后的数据
   */
  private formatApp(app: any, showSecret: boolean = false) {
    return {
      id: app.id,
      name: app.name,
      code: app.code,
      apiKey: app.apiKey,
      secretKey: showSecret ? app.secretKey : '******',
      qpsLimit: app.qpsLimit,
      dailyLimit: app.dailyLimit,
      tokenLimit: app.tokenLimit,
      enableOAuth: app.enableOAuth,
      status: app.status,
      expireAt: app.expireAt,
      permissions: parseTenantPermissions(app.permissions || '{}'),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }
}

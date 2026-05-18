import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 应用隔离上下文
 */
export interface IsolationContext {
  /** 应用标识 */
  appCode: string | null;
  /** 是否为超级管理员 */
  isSuperAdmin: boolean;
}

/**
 * 应用隔离服务配置
 */
export interface IsolationServiceConfig {
  /** 应用隔离字段名，默认 'appCode' */
  appCodeField?: string;
  /** 公开标识字段名，默认 'isPublic' */
  isPublicField?: string;
}

/**
 * 应用隔离服务
 *
 * 提供统一的应用隔离逻辑，支持：
 * - 自动过滤应用数据
 * - 支持公开资源访问
 * - 超级管理员跳过隔离
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class AgentService {
 *   constructor(
 *     private prisma: PrismaService,
 *     private isolationService: IsolationService,
 *   ) {}
 *
 *   async findAll(context: IsolationContext) {
 *     const where = this.isolationService.buildIsolationWhere(context);
 *     return this.prisma.agent.findMany({ where });
 *   }
 * }
 * ```
 */
@Injectable()
export class IsolationService {
  /** 默认应用隔离字段名 */
  private readonly appCodeField: string;
  /** 默认公开标识字段名 */
  private readonly isPublicField: string;

  constructor(config?: IsolationServiceConfig) {
    this.appCodeField = config?.appCodeField || 'appCode';
    this.isPublicField = config?.isPublicField || 'isPublic';
  }

  /**
   * 构建应用隔离查询条件
   * @param context 隔离上下文
   * @param options 配置选项
   * @returns 查询条件
   */
  buildIsolationWhere(
    context: IsolationContext,
    options?: {
      appCodeField?: string;
      isPublicField?: string;
      includePublic?: boolean;
    },
  ): any {
    const { appCode, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const isPublicField = options?.isPublicField || this.isPublicField;
    const includePublic = options?.includePublic ?? true;

    if (isSuperAdmin) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [isPublicField]: true };
      }
      return { [appCodeField]: null };
    }

    const conditions: any[] = [{ [appCodeField]: appCode }];

    if (includePublic) {
      conditions.push({ [isPublicField]: true });
    }

    return { OR: conditions };
  }

  /**
   * 构建创建数据（自动注入appCode）
   * @param data 原始数据
   * @param context 隔离上下文
   * @param options 配置选项
   * @returns 处理后的数据
   */
  buildCreateData<T extends Record<string, any>>(
    data: T,
    context: IsolationContext,
    options?: {
      appCodeField?: string;
    },
  ): T & { [key: string]: string | null } {
    const { appCode, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;

    if (isSuperAdmin) {
      if (data[appCodeField] !== undefined) {
        return data;
      }
      return data;
    }

    if (!appCode) {
      return data;
    }

    const { [appCodeField]: _, ...rest } = data as any;
    return {
      ...rest,
      [appCodeField]: appCode,
    };
  }

  /**
   * 构建更新/删除条件（确保只能操作自己应用的数据）
   * @param id 资源ID
   * @param context 隔离上下文
   * @param options 配置选项
   * @returns 查询条件
   */
  buildOwnerWhere(
    id: string,
    context: IsolationContext,
    options?: {
      appCodeField?: string;
    },
  ): any {
    const { appCode, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;

    const baseWhere: any = { id };

    if (isSuperAdmin) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [appCodeField]: null };
    }

    return {
      ...baseWhere,
      [appCodeField]: appCode,
    };
  }

  /**
   * 从请求中提取隔离上下文
   * @param request Express请求对象
   * @returns 隔离上下文
   */
  extractIsolationContext(request: any): IsolationContext {
    return {
      appCode: request.appCode || null,
      isSuperAdmin: request.isSuperAdmin || false,
    };
  }

  /**
   * 构建应用隔离查询条件（静态方法，向后兼容）
   * @param context 隔离上下文
   * @param appCodeField 应用标识字段名，默认 'appCode'
   * @param isPublicField 公开标识字段名，默认 'isPublic'
   * @param includePublic 是否包含公开资源，默认 true
   * @returns 查询条件
   */
  static buildIsolationWhere(
    context: IsolationContext,
    appCodeField: string = 'appCode',
    isPublicField: string = 'isPublic',
    includePublic: boolean = true,
  ): any {
    const { appCode, isSuperAdmin } = context;

    if (isSuperAdmin) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [isPublicField]: true };
      }
      return { [appCodeField]: null };
    }

    const conditions: any[] = [{ [appCodeField]: appCode }];

    if (includePublic) {
      conditions.push({ [isPublicField]: true });
    }

    return { OR: conditions };
  }

  /**
   * 构建创建数据（静态方法，向后兼容）
   * @param data 原始数据
   * @param context 隔离上下文
   * @param appCodeField 应用标识字段名，默认 'appCode'
   * @returns 处理后的数据
   */
  static buildCreateData<T extends Record<string, any>>(
    data: T,
    context: IsolationContext,
    appCodeField: string = 'appCode',
  ): T & { [key: string]: string | null } {
    const { appCode, isSuperAdmin } = context;

    if (isSuperAdmin) {
      if (data[appCodeField] !== undefined) {
        return data;
      }
      return data;
    }

    if (!appCode) {
      return data;
    }

    const { [appCodeField]: _, ...rest } = data as any;
    return {
      ...rest,
      [appCodeField]: appCode,
    };
  }

  /**
   * 构建更新/删除条件（静态方法，向后兼容）
   * @param id 资源ID
   * @param context 隔离上下文
   * @param appCodeField 应用标识字段名，默认 'appCode'
   * @returns 查询条件
   */
  static buildOwnerWhere(
    id: string,
    context: IsolationContext,
    appCodeField: string = 'appCode',
  ): any {
    const { appCode, isSuperAdmin } = context;

    const baseWhere: any = { id };

    if (isSuperAdmin) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [appCodeField]: null };
    }

    return {
      ...baseWhere,
      [appCodeField]: appCode,
    };
  }

  /**
   * 从请求中提取隔离上下文（静态方法）
   * @param request Express请求对象
   * @returns 隔离上下文
   */
  static extractIsolationContext(request: any): IsolationContext {
    return {
      appCode: request.appCode || null,
      isSuperAdmin: request.isSuperAdmin || false,
    };
  }
}

/**
 * 应用隔离服务基类（已废弃，请使用 IsolationService）
 * @deprecated 请使用 IsolationService
 */
@Injectable()
export abstract class BaseIsolatedService {
  protected prisma: PrismaClient;
  protected modelName: keyof PrismaClient;
  protected appCodeField: string;
  protected isPublicField: string;

  constructor(prisma: PrismaClient, config: { modelName: keyof PrismaClient; appCodeField?: string; isPublicField?: string }) {
    this.prisma = prisma;
    this.modelName = config.modelName;
    this.appCodeField = config.appCodeField || 'appCode';
    this.isPublicField = config.isPublicField || 'isPublic';
  }

  protected buildIsolationWhere(
    appCode: string | null,
    isSuperAdmin: boolean,
    includePublic: boolean = true,
  ): any {
    return IsolationService.buildIsolationWhere(
      { appCode, isSuperAdmin },
      this.appCodeField,
      this.isPublicField,
      includePublic,
    );
  }

  protected buildCreateData<T extends Record<string, any>>(
    data: T,
    appCode: string | null,
  ): T & { [key: string]: string | null } {
    return IsolationService.buildCreateData(data, { appCode, isSuperAdmin: false }, this.appCodeField);
  }

  protected buildUpdateWhere(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
  ): any {
    return IsolationService.buildOwnerWhere(id, { appCode, isSuperAdmin }, this.appCodeField);
  }

  protected buildDeleteWhere(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
  ): any {
    return this.buildUpdateWhere(id, appCode, isSuperAdmin);
  }

  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  async findMany<T = any>(
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
    includePublic: boolean = true,
  ): Promise<T[]> {
    const isolationWhere = this.buildIsolationWhere(appCode, isSuperAdmin, includePublic);
    const where = options.where ? { AND: [isolationWhere, options.where] } : isolationWhere;
    return this.model.findMany({ ...options, where });
  }

  async findOne<T = any>(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T | null> {
    const isolationWhere = this.buildIsolationWhere(appCode, isSuperAdmin);
    return this.model.findFirst({ ...options, where: { ...isolationWhere, id } });
  }

  async create<T = any>(data: any, appCode: string | null, options: any = {}): Promise<T> {
    const createData = this.buildCreateData(data, appCode);
    return this.model.create({ ...options, data: createData });
  }

  async update<T = any>(
    id: string,
    data: any,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T> {
    const where = this.buildUpdateWhere(id, appCode, isSuperAdmin);
    return this.model.update({ ...options, where, data });
  }

  async delete<T = any>(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T> {
    const where = this.buildDeleteWhere(id, appCode, isSuperAdmin);
    return this.model.delete({ ...options, where });
  }

  async count(
    appCode: string | null,
    isSuperAdmin: boolean,
    where: any = {},
    includePublic: boolean = true,
  ): Promise<number> {
    const isolationWhere = this.buildIsolationWhere(appCode, isSuperAdmin, includePublic);
    const finalWhere = Object.keys(where).length > 0 ? { AND: [isolationWhere, where] } : isolationWhere;
    return this.model.count({ where: finalWhere });
  }
}

export function extractIsolationContext(request: any): IsolationContext {
  return IsolationService.extractIsolationContext(request);
}

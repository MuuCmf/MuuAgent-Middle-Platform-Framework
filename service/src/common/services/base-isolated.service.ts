import { Injectable, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 应用隔离上下文
 */
export interface IsolationContext {
  /** 应用标识 */
  appCode: string | null;
  /** 是否为超级管理员 */
  isSuperAdmin: boolean;
  /** 用户唯一标识 */
  uid?: string;
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

  constructor(@Optional() config?: IsolationServiceConfig) {
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
      uidField?: string;
      isPublicField?: string;
      includePublic?: boolean;
      useUserIsolation?: boolean;
    },
  ): any {
    const { appCode, uid, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const isPublicField = options?.isPublicField || this.isPublicField;
    const includePublic = options?.includePublic ?? true;
    const useUserIsolation = options?.useUserIsolation ?? false;

    if (isSuperAdmin) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [isPublicField]: true };
      }
      return { [appCodeField]: null };
    }

    // 用户级隔离：可见范围 = 自己的私有技能 + 应用级公共技能(uid为空) + 公开技能
    if (useUserIsolation && uid) {
      const conditions: any[] = [
        // 用户私有技能：appCode匹配 + uid匹配
        { [appCodeField]: appCode, [uidField]: uid },
        // 应用级公共技能：appCode匹配 + uid为空
        { [appCodeField]: appCode, [uidField]: null },
      ];

      if (includePublic) {
        conditions.push({ [isPublicField]: true });
      }

      return { OR: conditions };
    }

    // 应用级隔离：可见范围 = 应用技能 + 公开技能
    const conditions: any[] = [{ [appCodeField]: appCode }];

    if (includePublic) {
      conditions.push({ [isPublicField]: true });
    }

    return { OR: conditions };
  }

  /**
   * 构建创建数据（自动注入appCode和uid）
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
      uidField?: string;
      useUserIsolation?: boolean;
    },
  ): T & { [key: string]: string | null } {
    const { appCode, uid, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const useUserIsolation = options?.useUserIsolation ?? false;

    if (isSuperAdmin) {
      return data;
    }

    let result: any = { ...data };

    if (appCode) {
      result = { ...result, [appCodeField]: appCode };
    }

    // 用户级隔离：自动注入uid（如果未指定uid则设为当前用户）
    if (useUserIsolation && uid && result[uidField] === undefined) {
      result = { ...result, [uidField]: uid };
    }

    return result;
  }

  /**
   * 构建更新/删除条件（确保只能操作自己应用或自己的数据）
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
      uidField?: string;
      useUserIsolation?: boolean;
    },
  ): any {
    const { appCode, uid, isSuperAdmin } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const useUserIsolation = options?.useUserIsolation ?? false;

    const baseWhere: any = { id };

    if (isSuperAdmin) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [appCodeField]: null };
    }

    // 用户级隔离：只能操作自己创建的技能或应用级公共技能(uid为空)
    if (useUserIsolation && uid) {
      return {
        ...baseWhere,
        [appCodeField]: appCode,
        OR: [
          { [uidField]: uid },      // 自己的私有技能
          { [uidField]: null },     // 应用级公共技能
        ],
      };
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
      uid: request.headers?.['x-uid'] || undefined,
    };
  }

  /**
   * 构建应用隔离查询条件（静态方法，向后兼容）
   * @param context 隔离上下文
   * @param appCodeField 应用标识字段名，默认 'appCode'
   * @param uidField 用户标识字段名，默认 'uid'
   * @param isPublicField 公开标识字段名，默认 'isPublic'
   * @param includePublic 是否包含公开资源，默认 true
   * @param useUserIsolation 是否启用用户级隔离，默认 false
   * @returns 查询条件
   */
  static buildIsolationWhere(
    context: IsolationContext,
    appCodeField: string = 'appCode',
    uidField: string = 'uid',
    isPublicField: string = 'isPublic',
    includePublic: boolean = true,
    useUserIsolation: boolean = false,
  ): any {
    const { appCode, uid, isSuperAdmin } = context;

    if (isSuperAdmin) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [isPublicField]: true };
      }
      return { [appCodeField]: null };
    }

    // 用户级隔离：可见范围 = 自己的私有技能 + 应用级公共技能(uid为空) + 公开技能
    if (useUserIsolation && uid) {
      const conditions: any[] = [
        { [appCodeField]: appCode, [uidField]: uid },
        { [appCodeField]: appCode, [uidField]: null },
      ];

      if (includePublic) {
        conditions.push({ [isPublicField]: true });
      }

      return { OR: conditions };
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
   * @param uidField 用户标识字段名，默认 'uid'
   * @param useUserIsolation 是否启用用户级隔离，默认 false
   * @returns 处理后的数据
   */
  static buildCreateData<T extends Record<string, any>>(
    data: T,
    context: IsolationContext,
    appCodeField: string = 'appCode',
    uidField: string = 'uid',
    useUserIsolation: boolean = false,
  ): T & { [key: string]: string | null } {
    const { appCode, uid, isSuperAdmin } = context;

    if (isSuperAdmin) {
      return data;
    }

    let result: any = { ...data };

    if (appCode) {
      result = { ...result, [appCodeField]: appCode };
    }

    if (useUserIsolation && uid && result[uidField] === undefined) {
      result = { ...result, [uidField]: uid };
    }

    return result;
  }

  /**
   * 构建更新/删除条件（静态方法，向后兼容）
   * @param id 资源ID
   * @param context 隔离上下文
   * @param appCodeField 应用标识字段名，默认 'appCode'
   * @param uidField 用户标识字段名，默认 'uid'
   * @param useUserIsolation 是否启用用户级隔离，默认 false
   * @returns 查询条件
   */
  static buildOwnerWhere(
    id: string,
    context: IsolationContext,
    appCodeField: string = 'appCode',
    uidField: string = 'uid',
    useUserIsolation: boolean = false,
  ): any {
    const { appCode, uid, isSuperAdmin } = context;

    const baseWhere: any = { id };

    if (isSuperAdmin) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [appCodeField]: null };
    }

    // 用户级隔离：只能操作自己创建的技能或应用级公共技能(uid为空)
    if (useUserIsolation && uid) {
      return {
        ...baseWhere,
        [appCodeField]: appCode,
        OR: [
          { [uidField]: uid },
          { [uidField]: null },
        ],
      };
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
      'uid',
      this.isPublicField,
      includePublic,
    );
  }

  protected buildCreateData<T extends Record<string, any>>(
    data: T,
    appCode: string | null,
  ): T & { [key: string]: string | null } {
    return IsolationService.buildCreateData(data, { appCode, isSuperAdmin: false }, this.appCodeField, 'uid', false);
  }

  protected buildUpdateWhere(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
  ): any {
    return IsolationService.buildOwnerWhere(id, { appCode, isSuperAdmin }, this.appCodeField, 'uid', false);
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

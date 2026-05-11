import { PrismaClient } from '@prisma/client';

/**
 * 应用隔离服务基类配置
 */
export interface BaseIsolatedServiceConfig {
  /** 资源模型名称 */
  modelName: keyof PrismaClient;

  /** 应用隔离字段名，默认 'appCode' */
  appCodeField?: string;

  /** 公开标识字段名，默认 'isPublic' */
  isPublicField?: string;
}

/**
 * 应用隔离服务基类
 * 
 * 提供应用隔离的通用CRUD操作，支持：
 * - 自动过滤应用数据
 * - 支持公开资源访问
 * - 超级管理员跳过隔离
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class AgentService extends BaseIsolatedService {
 *   constructor(prisma: PrismaService) {
 *     super(prisma, { modelName: 'agent' });
 *   }
 * }
 * ```
 */
export abstract class BaseIsolatedService {
  /** Prisma客户端 */
  protected prisma: PrismaClient;

  /** 资源模型名称 */
  protected modelName: keyof PrismaClient;

  /** 应用隔离字段名 */
  protected appCodeField: string;

  /** 公开标识字段名 */
  protected isPublicField: string;

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param config 配置
   */
  constructor(prisma: PrismaClient, config: BaseIsolatedServiceConfig) {
    this.prisma = prisma;
    this.modelName = config.modelName;
    this.appCodeField = config.appCodeField || 'appCode';
    this.isPublicField = config.isPublicField || 'isPublic';
  }

  /**
   * 构建应用隔离查询条件
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param includePublic 是否包含公开资源
   * @returns {object} 查询条件
   */
  protected buildIsolationWhere(
    appCode: string | null,
    isSuperAdmin: boolean,
    includePublic: boolean = true,
  ): any {
    if (isSuperAdmin) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [this.isPublicField]: true };
      }
      return { [this.appCodeField]: null };
    }

    const conditions: any[] = [{ [this.appCodeField]: appCode }];

    if (includePublic) {
      conditions.push({ [this.isPublicField]: true });
    }

    return { OR: conditions };
  }

  /**
   * 构建创建数据（自动注入appCode）
   * @param data 原始数据
   * @param appCode 应用标识
   * @returns {object} 处理后的数据
   */
  protected buildCreateData<T extends Record<string, any>>(
    data: T,
    appCode: string | null,
  ): T & { [key: string]: string | null } {
    if (!appCode) {
      return data;
    }

    return {
      ...data,
      [this.appCodeField]: appCode,
    };
  }

  /**
   * 构建更新条件（确保只能更新自己应用的数据）
   * @param id 资源ID
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @returns {object} 查询条件
   */
  protected buildUpdateWhere(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
  ): any {
    const baseWhere: any = { id };

    if (isSuperAdmin) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [this.appCodeField]: null };
    }

    return {
      ...baseWhere,
      [this.appCodeField]: appCode,
    };
  }

  /**
   * 构建删除条件（确保只能删除自己应用的数据）
   * @param id 资源ID
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @returns {object} 查询条件
   */
  protected buildDeleteWhere(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
  ): any {
    return this.buildUpdateWhere(id, appCode, isSuperAdmin);
  }

  /**
   * 获取模型委托
   * @returns {any} 模型委托
   */
  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * 查询列表（带应用隔离）
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param options 额外查询选项
   * @param includePublic 是否包含公开资源
   * @returns {Promise<T[]>} 列表数据
   */
  async findMany<T = any>(
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
    includePublic: boolean = true,
  ): Promise<T[]> {
    const isolationWhere = this.buildIsolationWhere(
      appCode,
      isSuperAdmin,
      includePublic,
    );

    const where = options.where
      ? { AND: [isolationWhere, options.where] }
      : isolationWhere;

    return this.model.findMany({
      ...options,
      where,
    });
  }

  /**
   * 查询单条（带应用隔离）
   * @param id 资源ID
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param options 额外查询选项
   * @returns {Promise<T | null>} 单条数据
   */
  async findOne<T = any>(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T | null> {
    const isolationWhere = this.buildIsolationWhere(appCode, isSuperAdmin);

    const where = {
      ...isolationWhere,
      id,
    };

    return this.model.findFirst({
      ...options,
      where,
    });
  }

  /**
   * 创建资源（自动注入appCode）
   * @param data 创建数据
   * @param appCode 应用标识
   * @param options 额外选项
   * @returns {Promise<T>} 创建结果
   */
  async create<T = any>(
    data: any,
    appCode: string | null,
    options: any = {},
  ): Promise<T> {
    const createData = this.buildCreateData(data, appCode);

    return this.model.create({
      ...options,
      data: createData,
    });
  }

  /**
   * 更新资源（带应用隔离校验）
   * @param id 资源ID
   * @param data 更新数据
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param options 额外选项
   * @returns {Promise<T>} 更新结果
   */
  async update<T = any>(
    id: string,
    data: any,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T> {
    const where = this.buildUpdateWhere(id, appCode, isSuperAdmin);

    return this.model.update({
      ...options,
      where,
      data,
    });
  }

  /**
   * 删除资源（带应用隔离校验）
   * @param id 资源ID
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param options 额外选项
   * @returns {Promise<T>} 删除结果
   */
  async delete<T = any>(
    id: string,
    appCode: string | null,
    isSuperAdmin: boolean,
    options: any = {},
  ): Promise<T> {
    const where = this.buildDeleteWhere(id, appCode, isSuperAdmin);

    return this.model.delete({
      ...options,
      where,
    });
  }

  /**
   * 统计数量（带应用隔离）
   * @param appCode 应用标识
   * @param isSuperAdmin 是否为超级管理员
   * @param where 额外查询条件
   * @param includePublic 是否包含公开资源
   * @returns {Promise<number>} 数量
   */
  async count(
    appCode: string | null,
    isSuperAdmin: boolean,
    where: any = {},
    includePublic: boolean = true,
  ): Promise<number> {
    const isolationWhere = this.buildIsolationWhere(
      appCode,
      isSuperAdmin,
      includePublic,
    );

    const finalWhere = Object.keys(where).length > 0
      ? { AND: [isolationWhere, where] }
      : isolationWhere;

    return this.model.count({ where: finalWhere });
  }
}

import { Injectable, Optional } from '@nestjs/common';

/**
 * 应用隔离上下文
 */
export interface IsolationContext {
  /** 应用标识 */
  appCode: string | null;
  /**
   * 是否跳过数据隔离
   * - true: 全数据可见（管理后台 JWT 管理员）
   * - false: 按 appCode 隔离（租户端 OAuth/Tenant）
   */
  skipIsolation: boolean;
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
 * - 管理后台跳过隔离（skipIsolation）
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
    const { appCode, uid, skipIsolation } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const isPublicField = options?.isPublicField || this.isPublicField;
    const includePublic = options?.includePublic ?? true;
    const useUserIsolation = options?.useUserIsolation ?? false;

    if (skipIsolation) {
      return {};
    }

    if (!appCode) {
      if (includePublic) {
        return { [isPublicField]: true };
      }
      return { [appCodeField]: null };
    }

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
    const { appCode, uid, skipIsolation } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const useUserIsolation = options?.useUserIsolation ?? false;

    if (skipIsolation) {
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
    const { appCode, uid, skipIsolation } = context;
    const appCodeField = options?.appCodeField || this.appCodeField;
    const uidField = options?.uidField || 'uid';
    const useUserIsolation = options?.useUserIsolation ?? false;

    const baseWhere: any = { id };

    if (skipIsolation) {
      return baseWhere;
    }

    if (!appCode) {
      return { ...baseWhere, [appCodeField]: null };
    }

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
}

/**
 * 从请求中提取隔离上下文
 *
 * 数据隔离规则：
 * - 管理后台（JWT）管理员：skipIsolation=true，全数据可见
 * - 租户端（OAuth/Tenant）：skipIsolation 取决于是否为超管，按 appCode 隔离
 *
 * @param request Express请求对象
 * @returns 隔离上下文
 */
export function extractIsolationContext(request: any): IsolationContext {
  const authType = request.authType;
  const isSuperAdmin = request.isSuperAdmin || false;

  if (authType === 'jwt') {
    return {
      appCode: request.appCode || null,
      skipIsolation: true,
    };
  }

  return {
    appCode: request.appCode || null,
    skipIsolation: isSuperAdmin,
    uid: request.headers?.['x-uid'] || undefined,
  };
}

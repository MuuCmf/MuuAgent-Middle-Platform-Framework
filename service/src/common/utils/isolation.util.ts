/**
 * 应用隔离辅助函数
 * 用于构建应用隔离的查询条件
 */

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
 * 构建应用隔离查询条件
 * @param context 隔离上下文
 * @param appCodeField 应用标识字段名，默认 'appCode'
 * @param isPublicField 公开标识字段名，默认 'isPublic'
 * @param includePublic 是否包含公开资源，默认 true
 * @returns {object} 查询条件
 */
export function buildIsolationWhere(
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
 * 构建创建数据（自动注入appCode）
 * @param data 原始数据
 * @param context 隔离上下文
 * @param appCodeField 应用标识字段名，默认 'appCode'
 * @returns {object} 处理后的数据
 */
export function buildCreateData<T extends Record<string, any>>(
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
 * 构建更新/删除条件（确保只能操作自己应用的数据）
 * @param id 资源ID
 * @param context 隔离上下文
 * @param appCodeField 应用标识字段名，默认 'appCode'
 * @returns {object} 查询条件
 */
export function buildOwnerWhere(
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
 * 从请求中提取隔离上下文
 * @param request Express请求对象
 * @returns {IsolationContext} 隔离上下文
 */
export function extractIsolationContext(request: any): IsolationContext {
  return {
    appCode: request.appCode || null,
    isSuperAdmin: request.isSuperAdmin || false,
  };
}

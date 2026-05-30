import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPE_KEY } from '../decorators/scope.decorator';
import { SCOPE_HIERARCHY, ROLE_SCOPES, AdminRole } from '../constants/scope.constants';
import { Request } from 'express';

/**
 * Scope 权限校验守卫
 *
 * 工作机制：
 * 1. 从 Reflector 读取接口上 @RequireScope() 声明的所需 scope
 * 2. 若无声明则放行（向后兼容）
 * 3. 超级管理员（isSuperAdmin=true 或 role=admin）直接放行
 * 4. JWT 管理员（authType=jwt）根据 role 查 ROLE_SCOPES 映射校验
 * 5. OAuth 用户校验其 scope 是否满足所有要求
 * 6. 支持 scope 层级展开（write 包含 read）
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authType = (request as any).authType;
    const admin = request.admin as any;

    // 超级管理员直接放行
    if ((request as any).isSuperAdmin === true || admin?.role === AdminRole.ADMIN) {
      return true;
    }

    // JWT 管理员：根据 role 映射 scope 校验
    if (authType === 'jwt') {
      const role = admin?.role as string;
      const roleScopes = ROLE_SCOPES[role];

      if (!roleScopes) {
        throw new ForbiddenException(`未知角色: ${role}，权限不足`);
      }

      const expandedScopes = this.expandScopes(roleScopes);
      const hasPermission = requiredScopes.every((scope) =>
        expandedScopes.includes(scope),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `权限不足，当前角色 [${role}] 需要 scope: ${requiredScopes.join(', ')}`,
        );
      }

      return true;
    }

    // OAuth 用户校验 scope
    const userScopes: string[] = admin?.scope?.split(' ') ?? [];
    const expandedScopes = this.expandScopes(userScopes);

    const hasPermission = requiredScopes.every((scope) =>
      expandedScopes.includes(scope),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `权限不足，需要 scope: ${requiredScopes.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * 展开 scope 层级
   * 例如：拥有 model:write 自动获得 model:read
   * @param scopes 原始 scope 列表
   * @returns {string[]} 展开后的 scope 列表
   */
  private expandScopes(scopes: string[]): string[] {
    const result = new Set<string>(scopes);

    for (const scope of scopes) {
      const inherited = SCOPE_HIERARCHY[scope];
      if (inherited) {
        inherited.forEach((s) => result.add(s));
      }
    }

    return [...result];
  }
}

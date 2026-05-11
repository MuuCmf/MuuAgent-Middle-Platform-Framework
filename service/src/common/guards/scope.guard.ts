import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPE_KEY } from '../decorators/scope.decorator';
import { SCOPE_HIERARCHY } from '../constants/scope.constants';
import { Request } from 'express';

/**
 * Scope 权限校验守卫
 *
 * 工作机制：
 * 1. 从 Reflector 读取接口上 @RequireScope() 声明的所需 scope
 * 2. 若无声明则放行（向后兼容）
 * 3. JWT 管理员（authType=jwt）直接放行
 * 4. OAuth 用户校验其 scope 是否满足所有要求
 * 5. 支持 scope 层级展开（write 包含 read）
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取接口声明的所需 scope
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 未标记 @RequireScope 则放行
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authType = (request as any).authType;
    const admin = request.admin as any;

    // JWT 管理员（管理后台登录）拥有全部权限
    if (authType === 'jwt') {
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

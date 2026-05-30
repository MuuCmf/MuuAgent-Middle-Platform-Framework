import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TENANT_PERMISSION_KEY,
  TenantPermissionRequirement,
} from '../decorators/tenant-permission.decorator';
import {
  parseTenantPermissions,
  TENANT_PERMISSION_MODULE_LABELS,
} from '../constants/tenant-permission.constants';
import { Request } from 'express';

/**
 * 租户权限校验守卫
 *
 * 工作机制：
 * 1. 从 @RequireTenantPermission() 装饰器读取所需权限
 * 2. 从 request.tenant.permissions 获取租户权限配置
 * 3. 与默认值合并后，检查指定模块的指定操作是否允许
 * 4. 无声明则放行（向后兼容）
 * 5. 非租户请求（如管理端）放行
 */
@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 校验租户权限
   * @param context 执行上下文
   * @returns {boolean} 是否通过校验
   */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantPermissionRequirement>(
      TENANT_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tenant = (request as any).tenant;

    if (!tenant) {
      return true;
    }

    const permissions = parseTenantPermissions(tenant.permissions);
    const modulePerms = permissions[required.module];

    if (!modulePerms) {
      const moduleLabel = TENANT_PERMISSION_MODULE_LABELS[required.module] || required.module;
      throw new ForbiddenException(`租户无 ${moduleLabel} 模块权限`);
    }

    const allowed = (modulePerms as Record<string, boolean>)[required.action];
    if (!allowed) {
      const moduleLabel = TENANT_PERMISSION_MODULE_LABELS[required.module] || required.module;
      throw new ForbiddenException(
        `租户无 ${moduleLabel}.${required.action} 权限`,
      );
    }

    return true;
  }
}

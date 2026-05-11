import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { APP_ISOLATION_KEY, AppIsolationConfig } from '../decorators/app-isolation.decorator';

/**
 * 应用隔离守卫
 * 
 * 负责在请求处理前验证应用隔离规则：
 * 1. 检查是否启用应用隔离
 * 2. 从请求中提取应用标识
 * 3. 将应用标识注入到请求上下文中
 * 
 * 配合 @AppIsolation 装饰器使用
 */
@Injectable()
export class AppIsolationGuard implements CanActivate {
  /**
   * 构造函数
   * @param reflector 反射器，用于获取装饰器元数据
   */
  constructor(private reflector: Reflector) {}

  /**
   * 验证请求
   * @param context 执行上下文
   * @returns {Promise<boolean>} 是否通过验证
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<AppIsolationConfig>(
      APP_ISOLATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config || config.enabled === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const admin = (request as any).admin;
    const user = (request as any).user;
    const authType = (request as any).authType;

    if (authType === 'jwt') {
      if (admin?.role === 'super_admin') {
        (request as any).appCode = null;
        (request as any).isSuperAdmin = true;
        return true;
      }
      (request as any).appCode = null;
      (request as any).isSuperAdmin = false;
      return true;
    }

    if (authType === 'oauth') {
      const appCode = user?.appCode;

      if (!appCode) {
        throw new ForbiddenException('OAuth客户端未绑定应用，无法访问资源');
      }

      (request as any).appCode = appCode;
      (request as any).isSuperAdmin = false;
      return true;
    }

    throw new ForbiddenException('无法确定应用上下文');
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

/**
 * 租户鉴权守卫
 * 验证租户API密钥并检查配额
 */
@Injectable()
export class TenantGuard implements CanActivate {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

  /**
   * 验证租户请求
   * @param context 执行上下文
   * @returns {Promise<boolean>} 是否通过验证
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new HttpException('缺少API密钥', HttpStatus.UNAUTHORIZED);
    }

    // 查找租户
    const tenant = await this.prisma.appTenant.findUnique({
      where: { apiKey },
    });

    if (!tenant) {
      throw new HttpException('无效的API密钥', HttpStatus.UNAUTHORIZED);
    }

    if (!tenant.status) {
      throw new HttpException('租户已被禁用', HttpStatus.FORBIDDEN);
    }

    if (tenant.expireAt && new Date() > tenant.expireAt) {
      throw new HttpException('租户已过期', HttpStatus.FORBIDDEN);
    }

    // 将租户信息附加到请求对象
    (request as Request & { tenant: typeof tenant }).tenant = tenant;

    return true;
  }
}

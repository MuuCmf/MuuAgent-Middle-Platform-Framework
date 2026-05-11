import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

/**
 * 组合认证守卫
 * 同时支持JWT认证和OAuth Token认证
 * 
 * 认证顺序：
 * 1. 检查是否为JWT格式（三段式base64）
 * 2. 尝试JWT验证
 * 3. 尝试OAuth Token验证
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  /**
   * 构造函数
   * @param jwtService JWT服务
   * @param configService 配置服务
   * @param prisma Prisma服务
   */
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * 验证请求
   * @param context 执行上下文
   * @returns {Promise<boolean>} 是否通过验证
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少认证令牌');
    }

    const token = authHeader.substring(7);

    const isJwtFormat = token.split('.').length === 3;

    if (isJwtFormat) {
      const payload = await this.validateJwt(token);
      if (payload) {
        request.admin = payload;
        (request as any).authType = 'jwt';
        return true;
      }
    } else {
      const tokenInfo = await this.validateOAuthToken(token);
      if (tokenInfo) {
        (request as any).user = tokenInfo;
        request.admin = {
          id: tokenInfo.userId,
          role: 'oauth_user',
          scope: tokenInfo.scope,
        };
        (request as any).authType = 'oauth';
        return true;
      }
    }

    throw new UnauthorizedException('无效的认证令牌');
  }

  /**
   * 验证JWT Token
   * @param token JWT令牌
   * @returns {Promise<any | null>} 载荷信息
   */
  private async validateJwt(token: string): Promise<any | null> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      return null;
    }
  }

  /**
   * 验证OAuth Token
   * @param token OAuth令牌
   * @returns {Promise<any | null>} 令牌信息
   */
  private async validateOAuthToken(token: string): Promise<any | null> {
    try {
      const tokenRecord = await this.prisma.oAuthToken.findUnique({
        where: { accessToken: token },
        include: {
          client: {
            select: {
              appCode: true,
            },
          },
        },
      });

      if (!tokenRecord) {
        return null;
      }

      if (tokenRecord.expiresAt < new Date()) {
        return null;
      }

      return {
        userId: tokenRecord.userId,
        scope: tokenRecord.scope,
        clientId: tokenRecord.clientId,
        appCode: tokenRecord.client.appCode,
      };
    } catch {
      return null;
    }
  }
}

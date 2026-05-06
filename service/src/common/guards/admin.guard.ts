import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * 管理员JWT鉴权守卫
 * 验证请求头中的Authorization Bearer Token
 */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * 构造函数
   * @param jwtService JWT服务
   * @param configService 配置服务
   */
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 验证请求是否有效
   * @param context 执行上下文
   * @returns {Promise<boolean>} 是否通过验证
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('请先登录管理后台');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      request.admin = payload;
    } catch (error) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    return true;
  }

  /**
   * 从请求头中提取Token
   * @param request 请求对象
   * @returns {string | undefined} Token
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

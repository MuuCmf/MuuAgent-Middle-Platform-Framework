import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * API密钥鉴权守卫
 * 验证请求头中的x-api-key是否有效
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  /**
   * 构造函数
   * @param configService 配置服务
   */
  constructor(private configService: ConfigService) {}

  /**
   * 验证请求是否有效
   * @param context 执行上下文
   * @returns {boolean} 是否通过验证
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    const validApiKey = this.configService.get<string>('API_KEY');

    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('无效的API密钥');
    }

    return true;
  }
}

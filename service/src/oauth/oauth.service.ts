import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * OAuth认证服务
 */
@Injectable()
export class OAuthService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param jwtService JWT服务
   * @param configService 配置服务
   */
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 验证客户端
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @param redirectUri 回调地址
   * @returns {Promise<any>} 客户端信息
   */
  async validateClient(clientId: string, clientSecret?: string, redirectUri?: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client || client.status !== 1) {
      throw new UnauthorizedException('客户端不存在或已禁用');
    }

    if (clientSecret && client.clientSecret !== clientSecret) {
      throw new UnauthorizedException('客户端密钥错误');
    }

    if (redirectUri) {
      const redirectUris = JSON.parse(client.redirectUris);
      if (!redirectUris.includes(redirectUri)) {
        throw new BadRequestException('回调地址不匹配');
      }
    }

    return {
      ...client,
      redirectUris: JSON.parse(client.redirectUris),
      scopes: JSON.parse(client.scopes),
      grants: JSON.parse(client.grants),
    };
  }

  /**
   * 生成授权码
   * @param clientId 客户端ID
   * @param userId 用户ID
   * @param redirectUri 回调地址
   * @param scope 权限范围
   * @param state 状态参数
   * @returns {Promise<string>} 授权码
   */
  async generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scope: string,
    state?: string,
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.oAuthCode.create({
      data: {
        code,
        clientId,
        userId,
        redirectUri,
        scope,
        state,
        expiresAt,
      },
    });

    return code;
  }

  /**
   * 用授权码换取访问令牌
   * @param code 授权码
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @param redirectUri 回调地址
   * @returns {Promise<any>} 令牌信息
   */
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    await this.validateClient(clientId, clientSecret, redirectUri);

    const authCode = await this.prisma.oAuthCode.findUnique({
      where: { code },
    });

    if (!authCode) {
      throw new BadRequestException('授权码不存在');
    }

    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      throw new BadRequestException('授权码信息不匹配');
    }

    if (authCode.expiresAt < new Date()) {
      throw new BadRequestException('授权码已过期');
    }

    await this.prisma.oAuthCode.delete({ where: { code } });

    return this.generateTokens(clientId, authCode.userId, authCode.scope);
  }

  /**
   * 生成访问令牌和刷新令牌
   * @param clientId 客户端ID
   * @param userId 用户ID
   * @param scope 权限范围
   * @returns {Promise<any>} 令牌信息
   */
  async generateTokens(clientId: string, userId: string, scope: string) {
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    
    const accessTokenExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.oAuthToken.create({
      data: {
        accessToken,
        refreshToken,
        clientId,
        userId,
        scope,
        expiresAt: accessTokenExpires,
        refreshExpiresAt: refreshTokenExpires,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 7200,
      scope,
    };
  }

  /**
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @returns {Promise<any>} 新令牌信息
   */
  async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
    await this.validateClient(clientId, clientSecret);

    const token = await this.prisma.oAuthToken.findUnique({
      where: { refreshToken },
    });

    if (!token || token.clientId !== clientId) {
      throw new UnauthorizedException('刷新令牌无效');
    }

    if (token.refreshExpiresAt && token.refreshExpiresAt < new Date()) {
      throw new UnauthorizedException('刷新令牌已过期');
    }

    await this.prisma.oAuthToken.delete({ where: { refreshToken } });

    return this.generateTokens(clientId, token.userId, token.scope);
  }

  /**
   * 验证访问令牌
   * @param accessToken 访问令牌
   * @returns {Promise<any>} 令牌信息
   */
  async validateAccessToken(accessToken: string) {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { accessToken },
    });

    if (!token) {
      throw new UnauthorizedException('访问令牌无效');
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('访问令牌已过期');
    }

    return {
      userId: token.userId,
      scope: token.scope,
      clientId: token.clientId,
    };
  }

  /**
   * 撤销令牌
   * @param token 令牌
   * @returns {Promise<void>}
   */
  async revokeToken(token: string): Promise<void> {
    await this.prisma.oAuthToken.deleteMany({
      where: {
        OR: [
          { accessToken: token },
          { refreshToken: token },
        ],
      },
    });
  }
}

import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
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

  /**
   * 获取客户端列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param search 搜索关键词
   * @returns {Promise<any>} 客户端列表
   */
  async getClients(page: number = 1, pageSize: number = 10, search?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { clientId: { contains: search } },
      ];
    }

    const [total, clients] = await Promise.all([
      this.prisma.oAuthClient.count({ where }),
      this.prisma.oAuthClient.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      data: clients.map(client => ({
        ...client,
        redirectUris: JSON.parse(client.redirectUris),
        scopes: JSON.parse(client.scopes),
        grants: JSON.parse(client.grants),
      })),
    };
  }

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<any>} 客户端详情
   */
  async getClientById(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    const tokenCount = await this.prisma.oAuthToken.count({
      where: { clientId: client.clientId },
    });

    return {
      ...client,
      redirectUris: JSON.parse(client.redirectUris),
      scopes: JSON.parse(client.scopes),
      grants: JSON.parse(client.grants),
      tokenCount,
    };
  }

  /**
   * 创建客户端
   * @param data 客户端数据
   * @returns {Promise<any>} 创建的客户端
   */
  async createClient(data: {
    name: string;
    redirectUris: string[];
    scopes: string[];
    grants?: string[];
  }) {
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name: data.name,
        redirectUris: JSON.stringify(data.redirectUris),
        scopes: JSON.stringify(data.scopes),
        grants: JSON.stringify(data.grants || ['authorization_code', 'refresh_token']),
        status: 1,
      },
    });

    return {
      ...client,
      redirectUris: JSON.parse(client.redirectUris),
      scopes: JSON.parse(client.scopes),
      grants: JSON.parse(client.grants),
    };
  }

  /**
   * 更新客户端
   * @param id 客户端ID
   * @param data 更新数据
   * @returns {Promise<any>} 更新后的客户端
   */
  async updateClient(
    id: string,
    data: {
      name?: string;
      redirectUris?: string[];
      scopes?: string[];
      grants?: string[];
      status?: number;
    },
  ) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.redirectUris !== undefined) updateData.redirectUris = JSON.stringify(data.redirectUris);
    if (data.scopes !== undefined) updateData.scopes = JSON.stringify(data.scopes);
    if (data.grants !== undefined) updateData.grants = JSON.stringify(data.grants);
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await this.prisma.oAuthClient.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      redirectUris: JSON.parse(updated.redirectUris),
      scopes: JSON.parse(updated.scopes),
      grants: JSON.parse(updated.grants),
    };
  }

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<void>}
   */
  async deleteClient(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    await this.prisma.oAuthClient.delete({
      where: { id },
    });
  }

  /**
   * 重置客户端密钥
   * @param id 客户端ID
   * @returns {Promise<any>} 新的客户端密钥
   */
  async resetClientSecret(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    await this.prisma.oAuthClient.update({
      where: { id },
      data: { clientSecret: newSecret },
    });

    return {
      clientId: client.clientId,
      clientSecret: newSecret,
    };
  }

  /**
   * 获取令牌列表
   * @param page 页码
   * @param pageSize 每页数量
   * @param clientId 客户端ID（可选）
   * @returns {Promise<any>} 令牌列表
   */
  async getTokens(page: number = 1, pageSize: number = 10, clientId?: string) {
    const where: any = {};
    
    if (clientId) {
      where.clientId = clientId;
    }

    const [total, tokens] = await Promise.all([
      this.prisma.oAuthToken.count({ where }),
      this.prisma.oAuthToken.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      data: tokens.map(token => ({
        id: token.id,
        accessToken: token.accessToken.substring(0, 16) + '...',
        clientId: token.clientId,
        clientName: token.client.name,
        userId: token.userId,
        scope: token.scope,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
    };
  }

  /**
   * 通过ID撤销令牌
   * @param id 令牌ID
   * @returns {Promise<void>}
   */
  async revokeTokenById(id: string) {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { id },
    });

    if (!token) {
      throw new NotFoundException('令牌不存在');
    }

    await this.prisma.oAuthToken.delete({
      where: { id },
    });
  }
}

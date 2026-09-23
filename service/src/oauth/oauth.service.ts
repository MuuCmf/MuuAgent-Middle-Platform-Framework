import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { hashSecret } from '../common/utils/hash.util';
import * as crypto from 'crypto';

/**
 * OAuth认证服务
 */
@Injectable()
export class OAuthService {
  /** 客户端认证最大失败次数（超过后锁定） */
  private static readonly MAX_AUTH_FAILURES = 5;

  /** 认证失败锁定时长（毫秒） */
  private static readonly LOCK_DURATION_MS = 15 * 60 * 1000;

  /** 客户端认证失败计数（内存级，防暴力破解，key = clientId:ip） */
  private authFailures = new Map<string, { count: number; lockedUntil: number }>();

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param jwtService JWT服务
   * @param configService 配置服务
   */
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * 验证客户端
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @param redirectUri 回调地址
   * @param clientIp 客户端IP（用于失败锁定）
   * @returns {Promise<any>} 客户端信息
   */
  async validateClient(clientId: string, clientSecret?: string, redirectUri?: string, clientIp?: string) {
    const lockKey = clientSecret ? `${clientId}:${clientIp || 'unknown'}` : '';
    if (lockKey) {
      this.assertNotLocked(lockKey);
    }

    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });

    if (!client || client.status !== 1) {
      if (lockKey) {
        this.recordAuthFailure(lockKey);
      }
      throw new UnauthorizedException('客户端不存在或已禁用');
    }

    if (clientSecret && !this.timingSafeEqual(client.clientSecretHash, hashSecret(clientSecret))) {
      this.recordAuthFailure(lockKey);
      throw new UnauthorizedException('客户端密钥错误');
    }

    if (redirectUri) {
      const redirectUris = JSON.parse(client.redirectUris);
      if (!redirectUris.includes(redirectUri)) {
        throw new BadRequestException('回调地址不匹配');
      }
    }

    if (lockKey) {
      this.clearAuthFailure(lockKey);
    }

    return {
      ...client,
      redirectUris: JSON.parse(client.redirectUris),
      scopes: JSON.parse(client.scopes),
      grants: JSON.parse(client.grants),
    };
  }

  /**
   * 时序安全的字符串比较（避免逐字符比较的时间侧信道）
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * 检查客户端是否处于认证失败锁定状态
   */
  private assertNotLocked(lockKey: string): void {
    const record = this.authFailures.get(lockKey);
    if (record && record.lockedUntil > Date.now()) {
      const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      throw new HttpException(
        `认证失败次数过多，请 ${remainingSec} 秒后重试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * 记录一次认证失败（连续失败达到上限后锁定）
   */
  private recordAuthFailure(lockKey: string): void {
    const record = this.authFailures.get(lockKey);
    if (!record || record.lockedUntil <= Date.now()) {
      this.authFailures.set(lockKey, { count: 1, lockedUntil: 0 });
      return;
    }
    record.count += 1;
    if (record.count >= OAuthService.MAX_AUTH_FAILURES) {
      record.lockedUntil = Date.now() + OAuthService.LOCK_DURATION_MS;
      record.count = 0;
    }
  }

  /**
   * 认证成功后清除失败计数
   */
  private clearAuthFailure(lockKey: string): void {
    this.authFailures.delete(lockKey);
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
        userId: userId as any,
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
   * 客户端凭证模式生成令牌（client_credentials）
   * 适用于后端服务之间的直接调用，无需用户交互授权
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @param clientIp 客户端IP（用于失败锁定）
   * @returns {Promise<any>} 令牌信息
   */
  async generateClientCredentialsToken(clientId: string, clientSecret: string, clientIp?: string) {
    const client = await this.validateClient(clientId, clientSecret, undefined, clientIp);

    // validateClient 已经解析了 grants 和 scopes，无需再次解析
    const grants = client.grants as string[];
    if (!grants.includes('client_credentials')) {
      throw new BadRequestException('客户端不支持 client_credentials 授权类型');
    }

    const scopes = client.scopes as string[];
    const scopeString = scopes.join(' ');

    return this.generateTokens(clientId, '0', scopeString);
  }

  /**
   * 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @returns {Promise<any>} 新令牌信息
   */
  async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string, clientIp?: string) {
    await this.validateClient(clientId, clientSecret, undefined, clientIp);

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

    return this.generateTokens(clientId, token.userId as any, token.scope);
  }

  /**
   * 验证访问令牌
   * @param accessToken 访问令牌
   * @returns {Promise<any>} 令牌信息
   */
  async validateAccessToken(accessToken: string) {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { accessToken },
      include: {
        client: {
          select: {
            appCode: true,
          },
        },
      },
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
      appCode: token.client.appCode,
    };
  }

  /**
   * 吊销令牌
   * 按 RFC 7009 要求：必须先通过客户端认证，且仅能吊销本客户端（clientId）名下的令牌
   * @param token 要撤销的访问令牌或刷新令牌
   * @param clientId 客户端ID
   * @param clientSecret 客户端密钥
   * @param clientIp 客户端IP（用于失败锁定）
   */
  async revokeToken(token: string, clientId: string, clientSecret: string, clientIp?: string): Promise<void> {
    await this.validateClient(clientId, clientSecret, undefined, clientIp);

    await this.prisma.oAuthToken.deleteMany({
      where: {
        clientId,
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
   * @param appCode 应用标识
   * @returns {Promise<any>} 客户端列表
   */
  async getClients(page: number = 1, pageSize: number = 10, search?: string, appCode?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { clientId: { contains: search } },
      ];
    }

    if (appCode) {
      where.appCode = appCode;
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
      data: clients.map(client => this.formatClient(client)),
    };
  }

  /**
   * 获取客户端详情
   * @param id 客户端ID
   * @returns {Promise<any>} 客户端详情
   */
  async getClientById(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id: id as any },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    const tokenCount = await this.prisma.oAuthToken.count({
      where: { clientId: client.clientId },
    });

    return {
      ...this.formatClient(client),
      tokenCount,
    };
  }

  /**
   * 格式化客户端数据（不含密钥哈希，哈希不对外返回）
   * @param client 客户端数据
   * @returns {object} 格式化后的数据
   */
  private formatClient(client: any) {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      redirectUris: JSON.parse(client.redirectUris),
      scopes: JSON.parse(client.scopes),
      grants: JSON.parse(client.grants),
      appCode: client.appCode,
      status: client.status,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  /**
   * 创建客户端
   * @param data 客户端数据
   * @returns {Promise<any>} 创建的客户端
   */
  async createClient(data: {
    name: string;
    redirectUris?: string[];
    scopes: string[];
    grants?: string[];
    appCode?: string;
  }) {
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash: hashSecret(clientSecret),
        name: data.name,
        redirectUris: JSON.stringify(data.redirectUris ?? []),
        scopes: JSON.stringify(data.scopes),
        grants: JSON.stringify(data.grants || ['client_credentials', 'refresh_token']),
        appCode: data.appCode || null,
        status: 1,
      },
    });

    // 明文 clientSecret 仅在创建响应中返回一次，此后不可查询
    return {
      ...this.formatClient(client),
      clientSecret,
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
      where: { id: id as any },
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
      where: { id: id as any },
      data: updateData,
    });

    return this.formatClient(updated);
  }

  /**
   * 删除客户端
   * @param id 客户端ID
   * @returns {Promise<void>}
   */
  async deleteClient(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id: id as any },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    await this.prisma.oAuthClient.delete({
      where: { id: id as any },
    });
  }

  /**
   * 重置客户端密钥
   * @param id 客户端ID
   * @returns {Promise<any>} 新的客户端密钥
   */
  async resetClientSecret(id: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { id: id as any },
    });

    if (!client) {
      throw new NotFoundException('客户端不存在');
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    await this.prisma.oAuthClient.update({
      where: { id: id as any },
      data: { clientSecretHash: hashSecret(newSecret) },
    });

    // 明文密钥仅在重置响应中返回一次，此后不可查询
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
      where: { id: id as any },
    });

    if (!token) {
      throw new NotFoundException('令牌不存在');
    }

    await this.prisma.oAuthToken.delete({
      where: { id: id as any },
    });
  }
}

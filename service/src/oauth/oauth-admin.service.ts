import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as crypto from 'crypto';

/**
 * OAuth管理端服务
 */
@Injectable()
export class OAuthAdminService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   */
  constructor(private prisma: PrismaService) {}

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
   * 撤销令牌
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

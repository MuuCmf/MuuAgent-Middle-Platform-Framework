import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { McpServer } from '@prisma/client';
import { McpTransport } from './types/mcp-server.types';

/**
 * 创建 MCP Server 参数
 */
export interface CreateMcpServerParams {
  name: string;
  displayName?: string;
  description?: string;
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string;
  timeout?: number;
  enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  appCode?: string;
  createdBy?: string;
}

/**
 * 更新 MCP Server 参数
 */
export interface UpdateMcpServerParams {
  displayName?: string;
  description?: string;
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  apiKey?: string | null;
  timeout?: number;
  enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  healthStatus?: string;
  lastSyncAt?: Date;
  lastHealthCheck?: Date;
  updatedBy?: string;
}

/**
 * 查询 MCP Server 参数
 */
export interface FindMcpServerParams {
  enabled?: boolean;
  appCode?: string;
  healthStatus?: string;
  transport?: McpTransport;
}

/**
 * 分页查询 MCP Server 参数
 */
export interface FindMcpServerPageParams extends FindMcpServerParams {
  page?: number;
  pageSize?: number;
}

/**
 * MCP Server 数据访问层
 * 提供 MCP Server 配置的 CRUD 操作
 */
@Injectable()
export class McpServerRepository {
  private readonly logger = new Logger(McpServerRepository.name);

  /**
   * 构造函数
   * @param prisma Prisma 服务
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建 MCP Server
   * @param params 创建参数
   * @returns {Promise<McpServer>} 创建的 MCP Server
   */
  async create(params: CreateMcpServerParams): Promise<McpServer> {
    return this.prisma.mcpServer.create({
      data: {
        name: params.name,
        displayName: params.displayName,
        description: params.description,
        transport: params.transport || 'http',
        url: params.url,
        command: params.command,
        args: params.args ? JSON.stringify(params.args) : null,
        env: params.env ? JSON.stringify(params.env) : null,
        apiKey: params.apiKey,
        timeout: params.timeout || 30000,
        enabled: params.enabled ?? true,
        tools: params.tools ? JSON.stringify(params.tools) : null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        appCode: params.appCode,
        createdBy: params.createdBy,
      },
    });
  }

  /**
   * 根据 ID 查询 MCP Server
   * @param id MCP Server ID
   * @returns {Promise<McpServer | null>} MCP Server 或 null
   */
  async findById(id: bigint | string): Promise<McpServer | null> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;
    return this.prisma.mcpServer.findFirst({
      where: {
        id: idValue,
        isDeleted: false,
      },
    });
  }

  /**
   * 根据名称查询 MCP Server
   * @param name MCP Server 名称
   * @param appCode 应用标识（可选，用于租户隔离）
   * @returns {Promise<McpServer | null>} MCP Server 或 null
   */
  async findByName(name: string, appCode?: string): Promise<McpServer | null> {
    return this.prisma.mcpServer.findFirst({
      where: {
        name,
        isDeleted: false,
        ...(appCode && { appCode }),
      },
    });
  }

  /**
   * 查询所有 MCP Server
   * @param params 查询参数
   * @returns {Promise<McpServer[]>} MCP Server 列表
   */
  async findAll(params?: FindMcpServerParams): Promise<McpServer[]> {
    return this.prisma.mcpServer.findMany({
      where: {
        isDeleted: false,
        ...(params?.enabled !== undefined && { enabled: params.enabled }),
        ...(params?.appCode && { appCode: params.appCode }),
        ...(params?.healthStatus && { healthStatus: params.healthStatus }),
        ...(params?.transport && { transport: params.transport }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 分页查询 MCP Server
   * @param params 分页查询参数
   * @returns {Promise<{list: McpServer[]; total: number; page: number; pageSize: number}>} 分页结果
   */
  async findWithPagination(params?: FindMcpServerPageParams): Promise<{
    list: McpServer[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where = {
      isDeleted: false,
      ...(params?.enabled !== undefined && { enabled: params.enabled }),
      ...(params?.appCode && { appCode: params.appCode }),
      ...(params?.healthStatus && { healthStatus: params.healthStatus }),
      ...(params?.transport && { transport: params.transport }),
    };

    const [list, total] = await Promise.all([
      this.prisma.mcpServer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.mcpServer.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /**
   * 查询启用的 MCP Server
   * @param appCode 应用标识（可选）
   * @returns {Promise<McpServer[]>} 启用的 MCP Server 列表
   */
  async findEnabled(appCode?: string): Promise<McpServer[]> {
    return this.findAll({ enabled: true, appCode });
  }

  /**
   * 更新 MCP Server
   * @param id MCP Server ID
   * @param params 更新参数
   * @returns {Promise<McpServer>} 更新后的 MCP Server
   */
  async update(id: bigint | string, params: UpdateMcpServerParams): Promise<McpServer> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;

    const updateData: Record<string, unknown> = {};

    if (params.displayName !== undefined) updateData.displayName = params.displayName;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.transport !== undefined) updateData.transport = params.transport;
    if (params.url !== undefined) updateData.url = params.url;
    if (params.command !== undefined) updateData.command = params.command;
    if (params.args !== undefined) updateData.args = JSON.stringify(params.args);
    if (params.env !== undefined) updateData.env = JSON.stringify(params.env);
    if (params.apiKey !== undefined && params.apiKey !== '') {
      updateData.apiKey = params.apiKey;
    } else if (params.apiKey === null) {
      updateData.apiKey = null;
    }
    if (params.timeout !== undefined) updateData.timeout = params.timeout;
    if (params.enabled !== undefined) updateData.enabled = params.enabled;
    if (params.tools !== undefined) updateData.tools = JSON.stringify(params.tools);
    if (params.metadata !== undefined) updateData.metadata = JSON.stringify(params.metadata);
    if (params.healthStatus !== undefined) updateData.healthStatus = params.healthStatus;
    if (params.lastSyncAt !== undefined) updateData.lastSyncAt = params.lastSyncAt;
    if (params.lastHealthCheck !== undefined) updateData.lastHealthCheck = params.lastHealthCheck;
    if (params.updatedBy !== undefined) updateData.updatedBy = params.updatedBy;

    return this.prisma.mcpServer.update({
      where: { id: idValue },
      data: updateData,
    });
  }

  /**
   * 软删除 MCP Server
   * @param id MCP Server ID
   * @returns {Promise<McpServer>} 删除后的 MCP Server
   */
  async softDelete(id: bigint | string): Promise<McpServer> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;
    return this.prisma.mcpServer.update({
      where: { id: idValue },
      data: { isDeleted: true },
    });
  }

  /**
   * 硬删除 MCP Server
   * @param id MCP Server ID
   * @returns {Promise<McpServer>} 删除的 MCP Server
   */
  async delete(id: bigint | string): Promise<McpServer> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;
    return this.prisma.mcpServer.delete({
      where: { id: idValue },
    });
  }

  /**
   * 检查名称是否已存在
   * @param name MCP Server 名称
   * @param excludeId 排除的 ID（用于更新时检查）
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByName(name: string, excludeId?: bigint | string): Promise<boolean> {
    const count = await this.prisma.mcpServer.count({
      where: {
        name,
        isDeleted: false,
        ...(excludeId && { id: { not: typeof excludeId === 'string' ? BigInt(excludeId) : excludeId } }),
      },
    });
    return count > 0;
  }

  /**
   * 更新健康状态
   * @param id MCP Server ID
   * @param healthStatus 健康状态
   * @returns {Promise<void>}
   */
  async updateHealthStatus(id: bigint | string, healthStatus: string): Promise<void> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;
    await this.prisma.mcpServer.update({
      where: { id: idValue },
      data: {
        healthStatus,
        lastHealthCheck: new Date(),
      },
    });
  }

  /**
   * 更新同步时间
   * @param id MCP Server ID
   * @returns {Promise<void>}
   */
  async updateSyncTime(id: bigint | string): Promise<void> {
    const idValue = typeof id === 'string' ? BigInt(id) : id;
    await this.prisma.mcpServer.update({
      where: { id: idValue },
      data: {
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * 解析 tools 字段
   * @param server MCP Server 记录
   * @returns {string[]} 工具列表
   */
  parseTools(server: McpServer): string[] {
    if (!server.tools) return [];
    try {
      return JSON.parse(server.tools);
    } catch {
      return [];
    }
  }

  /**
   * 解析 metadata 字段
   * @param server MCP Server 记录
   * @returns {Record<string, unknown>} 元数据对象
   */
  parseMetadata(server: McpServer): Record<string, unknown> {
    if (!server.metadata) return {};
    try {
      return JSON.parse(server.metadata as string);
    } catch {
      return {};
    }
  }

  /**
   * 解析 args 字段
   * @param server MCP Server 记录
   * @returns {string[]} 参数列表
   */
  parseArgs(server: McpServer): string[] {
    if (!server.args) return [];
    try {
      return JSON.parse(server.args);
    } catch {
      return [];
    }
  }

  /**
   * 解析 env 字段
   * @param server MCP Server 记录
   * @returns {Record<string, string>} 环境变量对象
   */
  parseEnv(server: McpServer): Record<string, string> {
    if (!server.env) return {};
    try {
      return JSON.parse(server.env);
    } catch {
      return {};
    }
  }
}

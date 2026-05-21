import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { McpServerRepository } from './mcp-server.repository';
import { IsolationContext } from '../common/services/base-isolated.service';
import { McpServer } from '@prisma/client';
import { McpServerRuntimeConfig, McpTransport, validateMcpServerConfig } from './types/mcp-server.types';

/**
 * MCP Server 配置（运行时使用）
 */
export interface McpServerConfig extends McpServerRuntimeConfig {}

/**
 * 缓存项
 */
interface CacheItem {
  config: McpServerConfig;
  expireAt: number;
}

/**
 * MCP Server 注册表
 * 支持数据库持久化、内存缓存、事件通知
 */
@Injectable()
export class McpServerRegistry implements OnModuleInit {
  private readonly logger = new Logger(McpServerRegistry.name);

  /**
   * 内存缓存
   */
  private cache = new Map<string, CacheItem>();

  /**
   * 缓存 TTL（5分钟）
   */
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * 最后刷新时间
   */
  private lastRefresh = 0;

  /**
   * 构造函数
   * @param repository MCP Server 仓库
   * @param eventEmitter 事件发射器
   */
  constructor(
    private readonly repository: McpServerRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 模块初始化时加载配置
   */
  async onModuleInit() {
    await this.refresh();
  }

  /**
   * 刷新缓存
   */
  async refresh(): Promise<void> {
    const servers = await this.repository.findEnabled();
    this.cache.clear();

    for (const server of servers) {
      const config = this.toConfig(server);
      this.cache.set(config.name.toLowerCase(), {
        config,
        expireAt: Date.now() + this.CACHE_TTL,
      });
    }

    this.lastRefresh = Date.now();
    this.logger.log(`已刷新 ${servers.length} 个 MCP Server 配置`);
  }

  /**
   * 确保缓存有效
   */
  private async ensureCache(): Promise<void> {
    const now = Date.now();
    if (this.cache.size === 0 || now - this.lastRefresh > this.CACHE_TTL) {
      await this.refresh();
    }
  }

  /**
   * 获取 MCP Server 配置
   * @param name 服务器名称
   * @returns {Promise<McpServerConfig | undefined>} 配置或 undefined
   */
  async get(name: string): Promise<McpServerConfig | undefined> {
    await this.ensureCache();
    const item = this.cache.get(name.toLowerCase());
    return item?.config;
  }

  /**
   * 获取 MCP Server 配置（兼容旧接口）
   * @param name 服务器名称
   * @param _isolationContext 隔离上下文（保留参数以保持接口一致）
   * @returns {Promise<McpServerConfig | undefined>} 配置或 undefined
   */
  async getServer(
    name: string,
    _isolationContext?: IsolationContext,
  ): Promise<McpServerConfig | undefined> {
    return this.get(name);
  }

  /**
   * 获取所有启用的 MCP Server
   * @param appCode 应用标识（可选，用于租户隔离）
   * @returns {Promise<McpServerConfig[]>} 配置列表
   */
  async getAll(appCode?: string): Promise<McpServerConfig[]> {
    await this.ensureCache();
    const configs = Array.from(this.cache.values()).map(item => item.config);

    if (appCode) {
      return configs.filter(c => !c.appCode || c.appCode === appCode);
    }

    return configs;
  }

  /**
   * 检查是否存在指定名称的 MCP Server
   * @param name 服务器名称
   * @returns {Promise<boolean>} 是否存在
   */
  async has(name: string): Promise<boolean> {
    await this.ensureCache();
    return this.cache.has(name.toLowerCase());
  }

  /**
   * 获取所有 MCP Server 名称
   * @returns {Promise<string[]>} 名称列表
   */
  async getNames(): Promise<string[]> {
    await this.ensureCache();
    return Array.from(this.cache.keys());
  }

  /**
   * 注册 MCP Server（创建或更新）
   * @param config 配置
   * @returns {Promise<McpServerConfig>} 配置
   */
  async register(config: Omit<McpServerConfig, 'id'>): Promise<McpServerConfig> {
    this.validateConfig(config);

    const name = config.name.toLowerCase();
    const existing = await this.repository.findByName(config.name);

    let server: McpServer;

    if (existing) {
      server = await this.repository.update(existing.id, {
        displayName: config.displayName,
        description: config.description,
        transport: config.transport,
        url: config.url,
        command: config.command,
        args: config.args,
        env: config.env,
        apiKey: config.apiKey,
        timeout: config.timeout,
        enabled: config.enabled,
        tools: config.tools,
        metadata: config.metadata,
      });

      this.eventEmitter.emit('mcp.server.updated', { name: config.name, config });
      this.logger.debug(`MCP Server 已更新: ${config.name}`);
    } else {
      server = await this.repository.create({
        name: config.name,
        displayName: config.displayName,
        description: config.description,
        transport: config.transport,
        url: config.url,
        command: config.command,
        args: config.args,
        env: config.env,
        apiKey: config.apiKey,
        timeout: config.timeout,
        enabled: config.enabled,
        tools: config.tools,
        metadata: config.metadata,
        appCode: config.appCode,
      });

      this.eventEmitter.emit('mcp.server.registered', { name: config.name, config });
      this.logger.debug(`MCP Server 已注册: ${config.name}`);
    }

    const newConfig = this.toConfig(server);
    this.cache.set(name, {
      config: newConfig,
      expireAt: Date.now() + this.CACHE_TTL,
    });

    return newConfig;
  }

  /**
   * 移除 MCP Server
   * @param name 服务器名称
   */
  async remove(name: string): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing) {
      await this.repository.softDelete(existing.id);
      this.cache.delete(name.toLowerCase());
      this.eventEmitter.emit('mcp.server.removed', { name });
      this.logger.debug(`MCP Server 已移除: ${name}`);
    }
  }

  /**
   * 更新健康状态
   * @param name 服务器名称
   * @param healthStatus 健康状态
   */
  async updateHealthStatus(name: string, healthStatus: string): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing) {
      await this.repository.updateHealthStatus(existing.id, healthStatus);

      const cached = this.cache.get(name.toLowerCase());
      if (cached) {
        cached.config.healthStatus = healthStatus;
      }
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.lastRefresh = 0;
    this.logger.log('MCP Server 缓存已清空');
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMs: this.CACHE_TTL,
      lastRefresh: this.lastRefresh,
      expiredCount: Array.from(this.cache.values()).filter(
        (item) => item.expireAt <= Date.now(),
      ).length,
    };
  }

  /**
   * 验证配置
   * @param config 配置
   */
  private validateConfig(config: Partial<McpServerConfig>): void {
    if (!config.name || !config.name.trim()) {
      throw new Error('MCP Server 名称不能为空');
    }

    const transport = config.transport || 'http';
    const validation = validateMcpServerConfig(transport, config.url, config.command);

    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
  }

  /**
   * 转换数据库记录为配置对象
   * @param server 数据库记录
   * @returns {McpServerConfig} 配置对象
   */
  private toConfig(server: McpServer): McpServerConfig {
    return {
      id: server.id.toString(),
      name: server.name,
      displayName: server.displayName || undefined,
      description: server.description || undefined,
      transport: (server.transport as McpTransport) || 'http',
      url: server.url || undefined,
      command: server.command || undefined,
      args: this.repository.parseArgs(server),
      env: this.repository.parseEnv(server),
      apiKey: server.apiKey || undefined,
      timeout: server.timeout,
      enabled: server.enabled,
      tools: this.repository.parseTools(server),
      metadata: this.repository.parseMetadata(server),
      appCode: server.appCode || undefined,
      healthStatus: server.healthStatus || undefined,
    };
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { DatabaseConnectionConfig, PoolEntry } from './dto/database-config.dto';

/**
 * 数据库连接池管理器
 * 负责数据库连接池的创建、缓存、健康检查和自动回收
 *
 * 设计要点：
 * - 每个技能独立维护连接池，按配置哈希区分
 * - 每个连接池最多 5 个并发连接
 * - 空闲超过 10 分钟的连接池自动回收
 * - 模块销毁时优雅关闭所有连接
 */
@Injectable()
export class ConnectionPoolManager implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolManager.name);

  /** 连接池缓存 Map<configHash, PoolEntry> */
  private readonly pools = new Map<string, PoolEntry>();

  /** 单个连接池最大连接数 */
  private readonly MAX_CONNECTIONS = 5;

  /** 空闲连接池回收时间（10 分钟） */
  private readonly IDLE_TIMEOUT_MS = 10 * 60 * 1000;

  /** 定时清理间隔（5 分钟） */
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  /** 定时器引用 */
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupIdlePools(), this.CLEANUP_INTERVAL_MS);
    this.logger.log('连接池管理器已启动，清理间隔: 5分钟，空闲超时: 10分钟');
  }

  /**
   * 获取或创建数据库连接池
   * @param databaseType 数据库类型
   * @param config 连接配置
   * @returns 连接池实例
   */
  getPool(databaseType: string, config: DatabaseConnectionConfig): mysql.Pool {
    const key = this.buildConfigHash(databaseType, config);
    const existing = this.pools.get(key);

    if (existing) {
      existing.lastUsedAt = new Date();
      this.logger.debug(`复用连接池: ${config.host}:${config.port}/${config.database}`);
      return existing.pool;
    }

    const pool = this.createPool(databaseType, config);
    this.pools.set(key, {
      pool,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      configHash: key,
    });

    this.logger.log(
      `创建新连接池 [${this.pools.size}]: ${config.host}:${config.port}/${config.database}`,
    );
    return pool;
  }

  /**
   * 测试数据库连接
   * @param databaseType 数据库类型
   * @param config 连接配置
   * @returns 测试结果，包含版本信息和延迟
   */
  async testConnection(
    databaseType: string,
    config: DatabaseConnectionConfig,
  ): Promise<{ success: boolean; serverVersion?: string; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    let connection: mysql.Connection | null = null;

    try {
      if (databaseType === 'mysql') {
        connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: config.ssl as any,
          connectTimeout: 10000,
        });

        const [rows] = await connection.execute('SELECT VERSION() AS version');
        const version = (rows as any[])[0]?.version || 'unknown';
        const latencyMs = Date.now() - startTime;

        return { success: true, serverVersion: version, latencyMs };
      }

      return { success: false, error: `不支持的数据库类型: ${databaseType}` };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '连接失败',
        latencyMs: Date.now() - startTime,
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * 获取当前连接池统计信息
   * @returns 统计信息
   */
  getStats(): { totalPools: number; pools: Array<{ host: string; age: number; idleMs: number }> } {
    const now = Date.now();
    const poolInfos: Array<{ host: string; age: number; idleMs: number }> = [];

    for (const [, entry] of this.pools) {
      poolInfos.push({
        host: this.parseHostFromHash(entry.configHash),
        age: now - entry.createdAt.getTime(),
        idleMs: now - entry.lastUsedAt.getTime(),
      });
    }

    return { totalPools: this.pools.size, pools: poolInfos };
  }

  /**
   * 创建数据库连接池
   * @param databaseType 数据库类型
   * @param config 连接配置
   * @returns 连接池实例
   */
  private createPool(
    databaseType: string,
    config: DatabaseConnectionConfig,
  ): mysql.Pool {
    if (databaseType === 'mysql') {
      return mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl as any,
        waitForConnections: true,
        connectionLimit: this.MAX_CONNECTIONS,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000,
      });
    }

    throw new Error(`不支持的数据库类型: ${databaseType}，当前仅支持 mysql`);
  }

  /**
   * 清理空闲连接池
   */
  private cleanupIdlePools(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.pools) {
      const idleMs = now - entry.lastUsedAt.getTime();
      if (idleMs > this.IDLE_TIMEOUT_MS) {
        this.logger.log(`回收空闲连接池: ${key} (空闲 ${Math.round(idleMs / 1000)}s)`);
        entry.pool.end().catch((err) =>
          this.logger.error(`关闭连接池失败: ${key}`, err),
        );
        this.pools.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`已回收 ${cleanedCount} 个空闲连接池，剩余 ${this.pools.size} 个`);
    }
  }

  /**
   * 生成连接配置的唯一哈希标识
   * @param databaseType 数据库类型
   * @param config 连接配置
   * @returns 哈希字符串
   */
  private buildConfigHash(databaseType: string, config: DatabaseConnectionConfig): string {
    return `${databaseType}://${config.user}@${config.host}:${config.port}/${config.database}`;
  }

  /**
   * 从配置哈希中提取主机信息（用于监控展示）
   * @param configHash 配置哈希
   * @returns 主机信息字符串
   */
  private parseHostFromHash(configHash: string): string {
    try {
      const match = configHash.match(/@([^/]+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 模块销毁时关闭所有连接池
   */
  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.logger.log(`正在关闭 ${this.pools.size} 个连接池...`);
    const closePromises: Promise<void>[] = [];

    for (const [key, entry] of this.pools) {
      closePromises.push(
        entry.pool.end().catch((err) =>
          this.logger.error(`关闭连接池失败: ${key}`, err),
        ),
      );
    }

    await Promise.all(closePromises);
    this.pools.clear();
    this.logger.log('所有连接池已关闭');
  }
}
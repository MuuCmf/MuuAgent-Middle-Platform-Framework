import { Injectable, Logger } from '@nestjs/common';
import { IsolationContext } from '../common/services/base-isolated.service';

/**
 * MCP Server 配置
 */
export interface McpServerConfig {
  name: string;
  url: string;
  apiKey?: string;
  description?: string;
  enabled?: boolean;
}

/**
 * MCP Server 注册表
 * 支持按名称引用 MCP Server 配置
 */
@Injectable()
export class McpServerRegistry {
  private readonly logger = new Logger(McpServerRegistry.name);
  private servers = new Map<string, McpServerConfig>();

  /**
   * 注册 MCP Server
   */
  register(config: McpServerConfig): void {
    const name = config.name.toLowerCase();
    this.servers.set(name, { ...config, enabled: config.enabled ?? true });
    this.logger.debug(`MCP Server 已注册: ${config.name}`);
  }

  /**
   * 批量注册
   */
  registerAll(configs: McpServerConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /**
   * 按名称获取 MCP Server 配置
   */
  get(name: string): McpServerConfig | undefined {
    return this.servers.get(name.toLowerCase());
  }

  /**
   * 获取 MCP Server 配置（兼容 context-builder 的调用方式）
   * @param name - MCP Server 名称
   * @param isolationContext - 隔离上下文（保留参数以保持接口一致）
   */
  getServer(name: string, _isolationContext?: IsolationContext): McpServerConfig | undefined {
    const config = this.servers.get(name.toLowerCase());
    if (!config) {
      this.logger.warn(`MCP Server ${name} 未在注册表中找到`);
    }
    return config;
  }

  /**
   * 获取所有注册的 MCP Server
   */
  getAll(): McpServerConfig[] {
    return Array.from(this.servers.values()).filter(s => s.enabled);
  }

  /**
   * 检查是否存在指定名称的 MCP Server
   */
  has(name: string): boolean {
    return this.servers.has(name.toLowerCase());
  }

  /**
   * 移除指定 MCP Server
   */
  remove(name: string): void {
    this.servers.delete(name.toLowerCase());
    this.logger.debug(`MCP Server 已移除: ${name}`);
  }

  /**
   * 获取所有注册的 MCP Server 名称
   */
  getNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.servers.clear();
    this.logger.log('MCP Server 注册表已清空');
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { McpClientService } from '../skill/mcp-client.service';
import { McpServerRegistry, McpServerConfig } from './mcp-server-registry';
import { McpServerRepository } from './mcp-server.repository';
import {
  McpServerConfigDto,
  DiscoverToolsDto,
  TestConnectionDto,
  ToolDescriptionDto,
} from './dto/mcp-server.dto';

/**
 * MCP工具定义接口
 */
interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP Server服务
 * 提供MCP Server的连接、工具发现和调用功能
 */
@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);

  /**
   * 构造函数
   * @param mcpClientService MCP客户端服务
   * @param registry MCP Server注册表
   * @param repository MCP Server仓库
   */
  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly registry: McpServerRegistry,
    private readonly repository: McpServerRepository,
  ) {}

  /**
   * 发现MCP Server提供的工具列表
   * @param dto 发现工具请求DTO
   * @returns {Promise<ToolDescriptionDto[]>} 工具描述列表
   */
  async discoverTools(dto: DiscoverToolsDto): Promise<ToolDescriptionDto[]> {
    this.logger.log(`开始发现工具: ${dto.url}`);

    try {
      const apiKey = await this.getApiKey(dto.serverId, dto.apiKey);

      const tools = await this.mcpClientService.listTools({
        url: dto.url,
        apiKey,
        timeout: dto.timeout || 30000,
      });

      return tools.map((tool: McpTool) => ({
        name: tool.name,
        source: 'mcp',
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`发现工具失败: ${err.message}`);
      throw error;
    }
  }

  /**
   * 按服务器名称发现工具
   * @param serverName 服务器名称
   * @returns {Promise<ToolDescriptionDto[]>} 工具描述列表
   */
  async discoverToolsByName(serverName: string): Promise<ToolDescriptionDto[]> {
    const config = await this.registry.get(serverName);
    if (!config) {
      throw new Error(`MCP Server "${serverName}" 未找到`);
    }

    const tools = await this.discoverTools({
      url: config.url,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });

    const filteredTools = this.filterTools(tools, config.tools, serverName);

    await this.repository.updateSyncTime(config.id);

    return filteredTools;
  }

  /**
   * 测试MCP Server连接
   * @param dto 测试连接请求DTO
   * @returns {Promise<{success: boolean; message: string; result?: unknown}>} 测试结果
   */
  async testConnection(dto: TestConnectionDto): Promise<{ success: boolean; message: string; result?: unknown }> {
    this.logger.log(`测试连接: ${dto.url}`);

    try {
      const apiKey = await this.getApiKey(dto.serverId, dto.apiKey);

      if (dto.toolName) {
        const result = await this.mcpClientService.callTool(
          {
            url: dto.url,
            apiKey,
            timeout: dto.timeout || 30000,
          },
          dto.toolName,
          dto.params || {},
        );

        return {
          success: true,
          message: '连接成功，工具调用成功',
          result,
        };
      } else {
        const tools = await this.mcpClientService.listTools({
          url: dto.url,
          apiKey,
          timeout: dto.timeout || 30000,
        });

        return {
          success: true,
          message: `连接成功，发现 ${tools.length} 个工具`,
          result: { toolCount: tools.length, tools },
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接失败';
      this.logger.error(`测试连接失败: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * 测试已注册的 MCP Server 连接
   * @param serverName 服务器名称
   * @returns {Promise<{success: boolean; message: string; latency?: number}>} 测试结果
   */
  async testConnectionByName(serverName: string): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const config = await this.registry.get(serverName);
    if (!config) {
      return {
        success: false,
        message: `MCP Server "${serverName}" 未找到`,
      };
    }

    const result = await this.mcpClientService.healthCheck({
      url: config.url,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });

    const healthStatus = result.healthy ? 'healthy' : 'unhealthy';
    await this.registry.updateHealthStatus(serverName, healthStatus);

    return {
      success: result.healthy,
      message: result.healthy ? '连接正常' : result.error || '连接失败',
      latency: result.latency,
    };
  }

  /**
   * 批量发现多个MCP Server的工具（并行）
   * @param configs MCP Server配置列表
   * @returns {Promise<ToolDescriptionDto[]>} 合并后的工具描述列表
   */
  async discoverAllTools(configs: McpServerConfigDto[]): Promise<ToolDescriptionDto[]> {
    const enabledConfigs = configs.filter(c => c.enabled !== false);

    const results = await Promise.allSettled(
      enabledConfigs.map(config =>
        this.discoverTools({
          url: config.url,
          apiKey: config.apiKey,
          timeout: config.timeout || 30000,
        }).then(tools => this.filterTools(tools, config.tools || [], config.name)),
      ),
    );

    const allTools: ToolDescriptionDto[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTools.push(...result.value);
        this.logger.log(
          `MCP Server ${enabledConfigs[index].name} 发现 ${result.value.length} 个工具`,
        );
      } else {
        this.logger.error(
          `MCP Server ${enabledConfigs[index].name} 发现工具失败: ${result.reason}`,
        );
      }
    });

    return allTools;
  }

  /**
   * 从注册表发现所有工具
   * @param appCode 应用标识（可选）
   * @returns {Promise<ToolDescriptionDto[]>} 工具描述列表
   */
  async discoverAllToolsFromRegistry(appCode?: string): Promise<ToolDescriptionDto[]> {
    const configs = await this.registry.getAll(appCode);

    const results = await Promise.allSettled(
      configs.map(async config => {
        const tools = await this.discoverTools({
          url: config.url,
          apiKey: config.apiKey,
          timeout: config.timeout,
        });
        return this.filterTools(tools, config.tools, config.name);
      }),
    );

    const allTools: ToolDescriptionDto[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTools.push(...result.value);
      } else {
        this.logger.error(
          `MCP Server ${configs[index].name} 发现工具失败: ${result.reason}`,
        );
      }
    });

    return allTools;
  }

  /**
   * 过滤工具列表
   * @param tools 工具列表
   * @param allowedTools 允许的工具列表
   * @param serverName 服务器名称
   * @returns {ToolDescriptionDto[]} 过滤后的工具列表
   */
  private filterTools(
    tools: ToolDescriptionDto[],
    allowedTools: string[],
    serverName: string,
  ): ToolDescriptionDto[] {
    let filtered = tools;

    if (allowedTools.length > 0) {
      filtered = tools.filter(tool => allowedTools.includes(tool.name));
    }

    return filtered.map(tool => ({
      ...tool,
      serverName,
      name: this.buildToolName(tool.name, serverName),
    }));
  }

  /**
   * 构建工具名称（添加前缀）
   * @param toolName 原始工具名称
   * @param serverName 服务器名称
   * @returns {string} 完整的工具名称
   */
  private buildToolName(toolName: string, serverName: string): string {
    return `mcp__${serverName}__${toolName}`;
  }

  /**
   * 解析工具名称
   * @param fullToolName 完整工具名称
   * @returns {{serverName: string; toolName: string} | null} 解析结果
   */
  parseToolName(fullToolName: string): { serverName: string; toolName: string } | null {
    const match = fullToolName.match(/^mcp__(.+)__(.+)$/);
    if (!match) {
      return null;
    }

    return {
      serverName: match[1],
      toolName: match[2],
    };
  }

  /**
   * 调用MCP工具
   * @param configs MCP Server配置列表
   * @param fullToolName 完整工具名称（包含前缀）
   * @param args 参数
   * @returns {Promise<unknown>} 执行结果
   */
  async callTool(
    configs: McpServerConfigDto[],
    fullToolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const parsed = this.parseToolName(fullToolName);
    if (!parsed) {
      throw new Error(`无效的MCP工具名称: ${fullToolName}`);
    }

    const config = configs.find(c => c.name === parsed.serverName);
    if (!config) {
      throw new Error(`未找到MCP Server: ${parsed.serverName}`);
    }

    if (config.enabled === false) {
      throw new Error(`MCP Server ${parsed.serverName} 已禁用`);
    }

    this.logger.log(`调用MCP工具: ${fullToolName}`);

    return this.mcpClientService.callTool(
      {
        url: config.url,
        apiKey: config.apiKey,
        timeout: config.timeout || 30000,
      },
      parsed.toolName,
      args,
    );
  }

  /**
   * 按名称调用MCP工具
   * @param serverName 服务器名称
   * @param toolName 工具名称
   * @param args 参数
   * @returns {Promise<unknown>} 执行结果
   */
  async callToolByName(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const config = await this.registry.get(serverName);
    if (!config) {
      throw new Error(`MCP Server "${serverName}" 未找到`);
    }

    if (!config.enabled) {
      throw new Error(`MCP Server ${serverName} 已禁用`);
    }

    this.logger.log(`调用MCP工具: ${serverName}/${toolName}`);

    return this.mcpClientService.callTool(
      {
        url: config.url,
        apiKey: config.apiKey,
        timeout: config.timeout,
      },
      toolName,
      args,
    );
  }

  /**
   * 健康检查所有 MCP Server
   * @param appCode 应用标识（可选）
   * @returns {Promise<Record<string, {healthy: boolean; latency: number}>>} 健康状态
   */
  async healthCheckAll(appCode?: string): Promise<Record<string, { healthy: boolean; latency: number }>> {
    const configs = await this.registry.getAll(appCode);
    const results: Record<string, { healthy: boolean; latency: number }> = {};

    await Promise.all(
      configs.map(async config => {
        const result = await this.mcpClientService.healthCheck({
          url: config.url,
          apiKey: config.apiKey,
          timeout: 5000,
        });

        const healthStatus = result.healthy ? 'healthy' : 'unhealthy';
        await this.registry.updateHealthStatus(config.name, healthStatus);

        results[config.name] = {
          healthy: result.healthy,
          latency: result.latency,
        };
      }),
    );

    return results;
  }

  /**
   * 构建工具描述文本（用于系统提示词）
   * @param tools 工具列表
   * @returns {string} 工具描述文本
   */
  buildToolsDescription(tools: ToolDescriptionDto[]): string {
    if (tools.length === 0) {
      return '';
    }

    const descriptions = tools.map(tool => {
      let desc = `- ${tool.name}: ${tool.description}`;
      if (tool.inputSchema && tool.inputSchema.properties) {
        const params = Object.entries(tool.inputSchema.properties)
          .map(([key, value]) => {
            const prop = value as { type?: string; description?: string };
            return `  - ${key}: ${prop.description || prop.type || '未知类型'}`;
          })
          .join('\n');
        desc += `\n  参数:\n${params}`;
      }
      return desc;
    });

    return descriptions.join('\n\n');
  }

  /**
   * 获取MCP Server配置列表
   * @param mcpServersJson MCP Server配置JSON字符串
   * @returns {McpServerConfigDto[]} 配置列表
   */
  parseMcpServersConfig(mcpServersJson: string | null): McpServerConfigDto[] {
    if (!mcpServersJson) {
      return [];
    }

    try {
      const configs = JSON.parse(mcpServersJson);
      return Array.isArray(configs) ? configs : [];
    } catch (error) {
      this.logger.error(`解析MCP Server配置失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取 API Key（优先使用传入的值，否则从数据库获取）
   * @param serverId MCP Server ID
   * @param providedApiKey 传入的 API Key
   * @returns {Promise<string | undefined>} API Key
   */
  private async getApiKey(
    serverId?: string,
    providedApiKey?: string,
  ): Promise<string | undefined> {
    if (providedApiKey) {
      return providedApiKey;
    }

    if (serverId) {
      const server = await this.repository.findById(serverId);
      if (server?.apiKey) {
        return server.apiKey;
      }
    }

    return undefined;
  }
}
